const STORAGE_KEY='davidsvez.island.exploration.v1';
const COSTS={shovel:3,jump:4};
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Local, optional exploration progression. Portfolio content is never gated. */
export function createProgression(scene,{THREE,flatMaterial,onMove,onDialogue,onNavigate,onChange,onSound}={}){
  const root=new THREE.Group();root.name='Exploration progression';scene.add(root);
  const targets=[],geometries=new Set(),materials=new Set(),pool=new Map();
  const matrix=new THREE.Object3D(),currentCharacter=new THREE.Vector3(0,0,3);
  const state={coins:0,shovel:false,jump:false,glide:false,collected:[],dug:[]};
  let disposed=false,revision=0,animation=null,audioEnabled=false,audioPrimed=false,muted=false,manualVisible=true,coinAudio=null;
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(saved&&typeof saved==='object'){
      state.coins=Number.isFinite(saved.coins)?Math.max(0,Math.min(9999,Math.floor(saved.coins))):0;
      state.shovel=!!saved.shovel;state.jump=!!saved.jump;state.glide=state.jump;
      state.collected=Array.isArray(saved.collected)?saved.collected.filter(id=>typeof id==='string').slice(0,100):[];
      state.dug=Array.isArray(saved.dug)?saved.dug.filter(id=>typeof id==='string').slice(0,20):[];
    }
  }catch{/* Storage is optional; private mode still supports the current session. */}
  function material(color,options={}){const key=color+JSON.stringify(options);if(!pool.has(key)){const mat=flatMaterial(color,options);pool.set(key,mat);materials.add(mat);}return pool.get(key);}
  function mesh(geometry,color,parent=root){geometries.add(geometry);const object=new THREE.Mesh(geometry,typeof color==='string'?material(color):color);parent.add(object);return object;}
  function group(name,x=0,z=0){const object=new THREE.Group();object.name=name;object.position.set(x,0,z);root.add(object);return object;}
  function box(parent,size,position,color,radius=0){
    // Small props use bevel-free cylinders/soft spheres where a silhouette matters.
    const object=mesh(new THREE.BoxGeometry(...size),color,parent);object.position.set(...position);return object;
  }
  function tag(object,id){object.traverse(child=>{child.userData.progressionId=id;if(child.isMesh){const original=child.raycast;child.raycast=function(ray,hits){for(let p=this;p&&p!==root.parent;p=p.parent)if(!p.visible)return;original.call(this,ray,hits);};}});targets.push(object);}
  const hills=[
    {id:'north',x:5.5,z:-18.5,rx:7.3,rz:6.2,height:4.4,terraced:true},
    {id:'south-step',x:.2,z:-10.2,rx:.9,rz:.75,height:.75},
    {id:'east-step',x:1,z:-12,rx:1.05,rz:.8,height:1.05},
    {id:'west-step',x:.7,z:-16.1,rx:.8,rz:1,height:1.2},
  ];
  function hillHeight(hill,x,z){
    const nx=(x-hill.x)/hill.rx,nz=(z-hill.z)/hill.rz,angle=Math.atan2(nz,nx);
    const shape=1+.025*Math.sin(angle*3)+.012*Math.cos(angle*5),radial=Math.hypot(nx,nz)/shape;
    if(radial>=1)return 0;
    if(!hill.terraced)return hill.height*(1-smooth(.64,.84,radial));
    return 1.0*(1-smooth(.91,.98,radial))+1.1*(1-smooth(.67,.73,radial))+1.1*(1-smooth(.41,.47,radial))+1.2*(1-smooth(.17,.23,radial));
  }
  function groundHeight(x,z){let height=0;for(const hill of hills)height=Math.max(height,hillHeight(hill,x,z));return height;}
  function mountain(){
    const vertices=[],colors=[],indices=[];
    const grass=['#b4c27b','#c1ca8a','#cdd3a0','#d7d9ae'].map(color=>new THREE.Color(color)),rock=new THREE.Color('#a4af9a');
    for(const hill of hills){
      const segments=hill.terraced?128:64,rings=hill.terraced?64:24,start=vertices.length/3;
      function vertex(x,z){
        const h=hillHeight(hill,x,z);
        let color;
        if(hill.terraced){
          const level=Math.min(3,h>3.25?3:h>2.15?2:h>1.05?1:0);
          const flat=[1,2.1,3.2,4.4].some(height=>Math.abs(height-h)<.035);
          color=flat?grass[level]:rock;
        }else color=Math.abs(h-hill.height)<.035?grass[0]:rock;
        vertices.push(x,h+.018,z);colors.push(color.r,color.g,color.b);
      }
      vertex(hill.x,hill.z);
      for(let ring=1;ring<=rings;ring++)for(let i=0;i<=segments;i++){
        const angle=i/segments*Math.PI*2,r=ring/rings,shape=1+.025*Math.sin(angle*3)+.012*Math.cos(angle*5);
        vertex(hill.x+Math.cos(angle)*hill.rx*r*shape,hill.z+Math.sin(angle)*hill.rz*r*shape);
      }
      for(let i=0;i<segments;i++)indices.push(start,start+i+2,start+i+1);
      for(let ring=1;ring<rings;ring++)for(let i=0;i<segments;i++){
        const a=start+1+(ring-1)*(segments+1)+i,b=a+segments+1,c=a+1,d=b+1;
        indices.push(a,c,b,c,d,b);
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const object=mesh(geometry,material('#ffffff',{vertexColors:true}));object.name='Rounded northern terraces';
  }
  mountain();

  // IDs are stable across the reduced trail, so existing local saves never
  // reset ownership or make an already collected coin reappear under a new ID.
  const positions=[
    {id:'coin-0',x:-1.1,z:3.8},{id:'coin-1',x:.2,z:2},{id:'coin-2',x:1,z:1},
    {id:'coin-3',x:-1.2,z:-1},{id:'coin-4',x:-1.2,z:-3.5},{id:'coin-5',x:-1.2,z:-6},
    {id:'coin-6',x:-1.2,z:-8.5},{id:'coin-10',x:-9,z:1.9},
    {id:'coin-17',x:2,z:-17},{id:'coin-18',x:5.4,z:-18.8},
  ];
  const coins=positions.map(position=>({...position,y:groundHeight(position.x,position.z)+.58,collected:state.collected.includes(position.id),pickup:0}));
  const coinGeometry=new THREE.CylinderGeometry(.225,.225,.055,24,1);coinGeometry.rotateX(Math.PI/2);geometries.add(coinGeometry);
  const ringGeometry=new THREE.RingGeometry(.115,.14,24);ringGeometry.translate(0,0,.031);geometries.add(ringGeometry);
  const coinMesh=new THREE.InstancedMesh(coinGeometry,material('#efc34e'),coins.length),ringMesh=new THREE.InstancedMesh(ringGeometry,material('#b78d35',{side:THREE.DoubleSide}),coins.length);
  coinMesh.name='Collectible coins';ringMesh.name='Coin emboss';coinMesh.frustumCulled=ringMesh.frustumCulled=false;root.add(coinMesh,ringMesh);
  coinMesh.userData.progressionId='coins';ringMesh.userData.progressionId='coins';targets.push(coinMesh,ringMesh);
  const originalCoinRaycast=coinMesh.raycast,originalRingRaycast=ringMesh.raycast;
  for(const [object,original] of [[coinMesh,originalCoinRaycast],[ringMesh,originalRingRaycast]])object.raycast=function(ray,hits){const result=[];original.call(this,ray,result);hits.push(...result.filter(hit=>!coins[hit.instanceId]?.collected));};

  const spots=[{id:'dig-west',x:-12,z:10.5},{id:'dig-east',x:11,z:-12},{id:'dig-garden',x:6,z:14.3}].map(spot=>{
    const object=group(spot.id,spot.x,spot.z),mark=new THREE.Group();object.add(mark);
    for(const angle of [-Math.PI/4,Math.PI/4]){const stroke=box(mark,[.13,.045,1.05],[0,.07,0],'#8c674c');stroke.rotation.y=angle;}
    const touchArea=mesh(new THREE.PlaneGeometry(1.45,1.45),material('#ffffff',{visible:false}),mark);touchArea.rotation.x=-Math.PI/2;touchArea.position.y=.078;
    const hole=mesh(new THREE.CircleGeometry(.48,40),'#8f7557',object);hole.rotation.x=-Math.PI/2;hole.position.y=.045;
    const rim=mesh(new THREE.TorusGeometry(.49,.045,6,40),'#c6af78',object);rim.rotation.x=-Math.PI/2;rim.position.y=.045;
    const treasure=new THREE.Group();object.add(treasure);treasure.position.y=.06;
    const chest=box(treasure,[.55,.30,.36],[0,.15,0],'#a57e4f');
    const lid=mesh(new THREE.CylinderGeometry(.18,.18,.55,16,1,false,0,Math.PI),'#b28d59',treasure);lid.rotation.z=Math.PI/2;lid.rotation.x=Math.PI/2;lid.position.y=.30;
    for(const x of [-.18,.18])box(treasure,[.045,.38,.38],[x,.2,0],'#d9b966');
    const dug=state.dug.includes(spot.id);mark.visible=!dug;hole.visible=rim.visible=treasure.visible=dug;
    mark.userData.progressionId=spot.id;tag(mark,spot.id);
    return {...spot,object,mark,hole,rim,treasure};
  });
  const shovel=group('Digging shovel');shovel.visible=false;
  const handle=mesh(new THREE.CylinderGeometry(.025,.025,.85,10),'#9f825a',shovel);handle.position.y=-.25;
  const grip=mesh(new THREE.TorusGeometry(.085,.017,8,20),'#765e46',shovel);grip.position.y=.21;
  const blade=mesh(new THREE.SphereGeometry(.13,16,10),'#a6b6ac',shovel);blade.scale.set(.9,1.1,.19);blade.position.y=-.75;
  const soilGeometry=new THREE.IcosahedronGeometry(.045,1);geometries.add(soilGeometry);
  const soilMesh=new THREE.InstancedMesh(soilGeometry,material('#a0825a'),32);root.add(soilMesh);soilMesh.frustumCulled=false;soilMesh.visible=false;
  const soil=Array.from({length:32},()=>({life:0}));
  let emittedStrike=-1;

  const hud=document.createElement('aside');hud.className='world-wallet';hud.setAttribute('aria-label','Exploration inventory');
  const coinIcon=document.createElement('span');coinIcon.className='wallet-coin';coinIcon.setAttribute('aria-hidden','true');
  const balance=document.createElement('span');balance.className='wallet-balance';
  const inventory=document.createElement('span');inventory.className='wallet-inventory';
  hud.append(coinIcon,balance,inventory);document.body.append(hud);
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./progression.css',import.meta.url).href;document.head.append(css);
  function renderWallet(){balance.textContent=String(state.coins);balance.setAttribute('aria-label',state.coins+' coins');inventory.textContent=[state.shovel?'♧':'',state.jump?'↑':''].filter(Boolean).join(' ');inventory.setAttribute('aria-label',[state.shovel?'Shovel owned':'',state.jump?'Jump and glide unlocked':''].filter(Boolean).join('. '));}
  function snapshot(){return {...state,collected:[...state.collected],dug:[...state.dug],digging:animation?.kind==='dig',mountain:{x:5.5,z:-18.5,height:4.4,radiusX:7.3,radiusZ:6.2},jumpPlaces:hills.map(hill=>({id:hill.id,x:hill.x,z:hill.z,height:hill.height})),coinPositions:coins.filter(coin=>!coin.collected).map(coin=>({id:coin.id,x:coin.x,y:coin.y,z:coin.z})),digSpots:spots.map(spot=>({id:spot.id,x:spot.x,z:spot.z,dug:state.dug.includes(spot.id)}))};}
  function notify(){renderWallet();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}onChange?.(snapshot());}
  renderWallet();
  function prepareAudio(){if(!coinAudio){coinAudio=new Audio(new URL('./assets/progression/coin-pickup.wav',import.meta.url).href);coinAudio.preload='none';coinAudio.volume=.25;}return coinAudio;}
  function pickupSound(){if(!audioEnabled||muted||document.hidden)return;const audio=prepareAudio();audio.pause();audio.currentTime=0;audio.muted=false;audio.play().catch(()=>{});}
  function collect(coin){if(coin.collected)return;coin.collected=true;coin.pickup=.33;state.collected.push(coin.id);state.coins++;pickupSound();notify();}
  function getActions(){return [
    {id:'buy-shovel',label:state.shovel?'Shovel owned':'Buy a shovel · 3 coins',cost:COSTS.shovel,owned:state.shovel,available:!state.shovel&&state.coins>=COSTS.shovel,description:'Dig at marked X spots in the clearing.'},
    {id:'learn-jump',label:state.jump?'Jump + glide learned':'Learn jump + glide · 4 coins',cost:COSTS.jump,owned:state.jump,available:!state.jump&&state.coins>=COSTS.jump,description:'Reach the rounded northern terraces.'},
  ];}
  function performAction(id){
    const item=getActions().find(action=>action.id===id);
    if(!item)return {ok:false,text:'That item is not available.',state:snapshot()};
    if(item.owned)return {ok:false,text:id==='buy-shovel'?'You already have a shovel. Look for an X.':'You can already jump and glide. Try the northern path.',state:snapshot()};
    if(state.coins<item.cost)return {ok:false,text:`You need ${item.cost} coins. There are more along the paths.`,state:snapshot()};
    state.coins-=item.cost;
    if(id==='buy-shovel')state.shovel=true;else state.jump=state.glide=true;
    notify();pickupSound();onSound?.('purchase',{x:currentCharacter.x,y:currentCharacter.y,z:currentCharacter.z});
    return {ok:true,text:id==='buy-shovel'?'The shovel is yours. Click a marked X to dig.':'You can jump and glide now. Choose a higher spot and try the northern terraces.',state:snapshot()};
  }
  function cancel(){
    revision++;
    if(animation?.spot&&!state.dug.includes(animation.spot.id)){
      const spot=animation.spot;spot.mark.visible=true;spot.hole.visible=spot.rim.visible=spot.treasure.visible=false;
      spot.hole.scale.setScalar(1);spot.rim.scale.setScalar(1);spot.treasure.scale.setScalar(1);
    }
    animation=null;shovel.visible=false;emittedStrike=-1;
  }
  function beginDig(spot,position,yaw){animation={kind:'dig',progress:0,position:{...position},yaw,spot,elapsed:0,rewarded:false};shovel.visible=true;emittedStrike=-1;}
  function activate(hit,point){
    const object=hit?.object||hit;let current=object,id;
    while(current&&!id){id=current.userData?.progressionId;current=current.parent;}
    if(!id)return false;
    if(id==='coins'){
      const coin=coins[hit.instanceId]||coins.filter(coin=>!coin.collected).sort((a,b)=>Math.hypot(a.x-(point?.x||0),a.z-(point?.z||0))-Math.hypot(b.x-(point?.x||0),b.z-(point?.z||0)))[0];
      if(coin&&!coin.collected)onMove?.({x:coin.x,z:coin.z},()=>{});return true;
    }
    const spot=spots.find(spot=>spot.id===id);if(!spot||state.dug.includes(id))return false;
    if(!state.shovel){onDialogue?.('shop');return true;}
    cancel();const token=revision,dx=currentCharacter.x-spot.x,dz=currentCharacter.z-spot.z,length=Math.hypot(dx,dz)||1;
    const position={x:spot.x+(length===1&&dx===0&&dz===0?0:dx/length*.8),y:groundHeight(spot.x,spot.z),z:spot.z+(dx===0&&dz===0?.8:dz/length*.8)};
    const yaw=Math.atan2(spot.x-position.x,spot.z-position.z);
    onMove?.({x:position.x,z:position.z},()=>{if(token===revision&&!disposed)beginDig(spot,position,yaw);});return true;
  }
  function burst(spot){let count=0;for(const particle of soil){if(particle.life>0)continue;const angle=Math.random()*Math.PI*2;Object.assign(particle,{x:spot.x,y:.12,z:spot.z,vx:Math.cos(angle)*(.4+Math.random()*.4),vy:1+Math.random()*.5,vz:Math.sin(angle)*(.4+Math.random()*.4),life:.7+Math.random()*.25});if(++count===8)break;}}
  function update(dt,time,{character,yaw=0,reduced=false,paused=false,airborne=false}={}){
    if(disposed)return;
    hud.hidden=!manualVisible||!!document.querySelector('#page-dialog[open]');
    if(character)currentCharacter.copy(character);
    if(paused)return;
    const step=Math.max(0,Math.min(.06,dt));
    for(let i=0;i<coins.length;i++){
      const coin=coins[i];
      if(!coin.collected&&Math.hypot(currentCharacter.x-coin.x,currentCharacter.z-coin.z)<.66&&Math.abs((currentCharacter.y+.62)-coin.y)<.85)collect(coin);
      let scale=coin.collected?coin.pickup/.33:1;
      if(coin.pickup>0)coin.pickup=Math.max(0,coin.pickup-step);
      matrix.position.set(coin.x,coin.y+(reduced?0:Math.sin(time*2.2+i)*.085)+(coin.collected?(1-scale)*.7:0),coin.z);matrix.rotation.set(0,reduced?.45:time*1.8+i*.7,0);matrix.scale.setScalar(Math.max(0,scale));matrix.updateMatrix();coinMesh.setMatrixAt(i,matrix.matrix);ringMesh.setMatrixAt(i,matrix.matrix);
    }
    coinMesh.instanceMatrix.needsUpdate=ringMesh.instanceMatrix.needsUpdate=true;
    if(animation){
      const a=animation;a.elapsed+=step;a.progress=Math.min(1,a.elapsed/2.1);const strike=Math.min(2,Math.floor(a.progress*3));
      shovel.position.set(a.position.x,.87,a.position.z);shovel.rotation.set(-.85+(reduced?0:Math.cos(a.progress*Math.PI*6)*.55),a.yaw,0);shovel.translateZ(.52);
      if(strike!==emittedStrike){emittedStrike=strike;if(!reduced)burst(a.spot);onSound?.('dig',{x:a.spot.x,y:.05,z:a.spot.z});}
      a.spot.hole.visible=a.spot.rim.visible=true;a.spot.hole.scale.setScalar(.3+a.progress*.7);a.spot.rim.scale.setScalar(.3+a.progress*.7);
      if(a.progress>.65){a.spot.mark.visible=false;a.spot.treasure.visible=true;a.spot.treasure.scale.setScalar(Math.min(1,(a.progress-.65)/.35));}
      if(a.progress===1){state.dug.push(a.spot.id);state.coins+=4;animation=null;shovel.visible=false;pickupSound();onSound?.('treasure',{x:a.spot.x,y:.1,z:a.spot.z});notify();}
    }
    let activeSoil=false;
    for(let i=0;i<soil.length;i++){const particle=soil[i];if(particle.life>0){activeSoil=true;particle.life-=step;particle.vy-=step*3;particle.x+=particle.vx*step;particle.y+=particle.vy*step;particle.z+=particle.vz*step;if(particle.y<.04)particle.life=0;matrix.position.set(particle.x,particle.y,particle.z);matrix.rotation.set(time*3+i,time*2+i,0);matrix.scale.setScalar(Math.max(0,Math.min(1,particle.life*3)));}else matrix.scale.setScalar(0);matrix.updateMatrix();soilMesh.setMatrixAt(i,matrix.matrix);}
    soilMesh.instanceMatrix.needsUpdate=true;soilMesh.visible=activeSoil;
  }
  update(0,0,{character:currentCharacter,reduced:true});
  return {
    targets,activate,update,getActions,performAction,cancel,
    getState:snapshot,getGroundHeight:groundHeight,
    getAnimation:()=>animation?{kind:'dig',progress:animation.progress,position:{...animation.position},yaw:animation.yaw}:null,
    enableAudio(){
      audioEnabled=true;if(audioPrimed)return;audioPrimed=true;
      // Prime this element silently during the parent's input gesture so later
      // proximity pickups are audible on browsers with strict mobile policies.
      const audio=prepareAudio();audio.muted=true;
      audio.play().then(()=>{audio.pause();audio.currentTime=0;audio.muted=false;}).catch(()=>{audio.muted=false;audioPrimed=false;});
    },setMuted(value){muted=!!value;if(muted)coinAudio?.pause();},
    setVisible(value){manualVisible=!!value;hud.hidden=!manualVisible;},
    dispose(){if(disposed)return;disposed=true;cancel();coinAudio?.pause();root.removeFromParent();hud.remove();css.remove();geometries.forEach(geometry=>geometry.dispose());materials.forEach(mat=>mat.dispose());targets.length=0;},
  };
}
