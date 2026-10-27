import * as THREE from './vendor/three.module.js';
import { destinations as sourceDestinations, asset } from './portfolio.js';
import { createGround, createWater } from './terrain.js';
import { createFoliage } from './foliage.js';
import { createProgression } from './progression.js';
import { createPathfinder } from './pathfinding.js';
import { createArrival } from './arrival.js';
import { createBoundaryForest, limitToClearing } from './looklab.js';
import { createActivities } from './activities.js';
import { createLocomotion } from './locomotion.js';
import { pageApproach, distanceToPage } from './navigation-geometry.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { flatMaterial, mergeStaticScenery } from './flat-style.js';

const UP = new THREE.Vector3(0, 1, 0);
const ground = new THREE.Plane(UP, 0);
const deltaAngle = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const damp = (a, b, speed, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-speed * dt));

export async function createLandscape(container, portfolio, { reduced, onSelect, onHover, onDialogue, onNavigate, audio, onFrame, onBark }) {
  const destinations=sourceDestinations.map(def=>({...def}));
  const arrival=createArrival();
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.04;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c6d3bd');
  scene.fog = new THREE.Fog('#c6d3bd', 45, 100);
  const loader = new GLTFLoader();
  const [characterAsset, greenTree, orangeTree] = await Promise.all(['character.glb','lightkeeper-tree.glb','lightkeeper-bushy.glb'].map(file => loader.loadAsync(new URL('./assets/' + file, import.meta.url).href)));
  const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, .1, 180);
  const cameraOffset = new THREE.Vector3(12, 23, 27);
  const cameraFocus = new THREE.Vector3(0, 0, 2.3);
  const cameraGoal = new THREE.Vector3();
  const pointer = new THREE.Vector2(), cursorWorld = new THREE.Vector3(0, 0, 8), scratch = new THREE.Vector3();
  const raycaster = new THREE.Raycaster(), target = new THREE.Vector3(0, 0, 3);
  const state = { intro:0,airborne:false,gliding:false,conversing:false, reduced, phase: 'idle', pending: null, hovered: null, paused: false, ready: false, speed: 0 };
  let baseSpan=20.2,currentSpan=0,verticalVelocity=0,jumpWanted=false;
  const arrivalOffset=new THREE.Vector3(4,52,10),normalOffset=new THREE.Vector3(12,23,27);
  let pathfinder,routeQueue=[],forcedDialogue=null,greeted=false,barkUntil=0;const goal=new THREE.Vector3(0,0,3);
  const speechSprings={you:{position:0,velocity:0,next:0},guide:{position:0,velocity:0,next:0}};
  function speechLetter(event){if(state.paused||state.reduced)return;const spring=speechSprings[event.detail?.speaker]||speechSprings.guide,now=performance.now()/1000;if(now<spring.next)return;spring.velocity+=4+Math.random()*3;spring.next=now+.1+Math.random()*.2;}
  document.addEventListener('portfolio-letter',speechLetter);
  function updateSpeech(dt){for(const spring of Object.values(speechSprings)){if(state.reduced){spring.position=spring.velocity=0;continue;}const decay=Math.exp(-18*dt),frequency=Math.sqrt(45*45-18*18),sine=Math.sin(frequency*dt),cosine=Math.cos(frequency*dt),p=spring.position,v=spring.velocity;spring.position=decay*(p*cosine+(v+18*p)/frequency*sine);spring.velocity=decay*(v*cosine-(18*v+2025*p)/frequency*sine);}}
  const cards = [], trees = [], materials = new Map(), videos = [];
  let seed = 34, cycle = 0, yaw = 0, lookYaw = 0, liftTime = 0, lastTime = 0, frame, pointerInside = false;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  function material(color, options = {}) {
    const key = color + JSON.stringify(options);
    if (!materials.has(key)) materials.set(key, flatMaterial(color, options));
    return materials.get(key);
  }
  function mesh(geometry, color, x = 0, y = 0, z = 0, parent = scene) {
    const object = new THREE.Mesh(geometry, typeof color === 'string' ? material(color) : color);
    object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const cube = new THREE.BoxGeometry(1, 1, 1), ico = new THREE.IcosahedronGeometry(1, 2), coarseIco = new THREE.IcosahedronGeometry(1, 1);
  function box(w, h, d, color, x, y, z, parent) { const object = mesh(cube, color, x, y, z, parent); object.scale.set(w, h, d); return object; }
  function blob(x, y, z, sx, sy, sz, color, parent = scene, coarse = false) { const object = mesh(coarse ? coarseIco : ico, color, x, y, z, parent); object.scale.set(sx, sy, sz); return object; }
  function flatShape(points, color, height = .03) {
    const shape = new THREE.Shape(); points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const object = mesh(new THREE.ShapeGeometry(shape), color, 0, height, 0); object.rotation.x = -Math.PI / 2; return object;
  }
  function patch(x, z, radius, color, height = .03, stretch = 1) {
    return flatShape(Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2, r = radius * (.85 + random() * .3); return [x + Math.cos(a) * r, z + Math.sin(a) * r * stretch]; }), color, height);
  }
  function tree(x, z, height, index) {
    // Keep the climbable terraces free of trunks and crowns rooted on the hill.
    if(Math.hypot((x-5.5)/7.8,(z+18.5)/6.7)<1.04)return;
    const px=x-height*.65*12/23,pz=z-height*.65*27/23;
    // Leave the whole pitch, goal runoff, and its projected sightline open.
    if((Math.abs(x+9.5)<9.1&&Math.abs(z+14.5)<6.2)||(Math.abs(px+9.5)<8.5+height*.3&&Math.abs(pz+14.5)<4.8+height*.3))return;
    if(z>9&&Math.hypot((px-13)/6,(pz-8.8)/5)<1.25)x+=6.5;
    if(z>12&&Math.hypot((px+12)/2.5,(pz-10.5)/3)<1.2)x-=4;
    trees.push({ id:trees.length,x, z, height, angle: random() * Math.PI * 2, variant: index % 3 });
  }
  const water=await createWater(scene);
  function makeTerrain(){
    createGround(scene);
    for(let i=0;i<63;i++){const a=i/63*Math.PI*2,ring=i%3===0?1.45:1;tree(Math.cos(a)*(20+random()*5)*ring,Math.sin(a)*(21+random()*4)*ring,3.7+random()*3.9,i);}
    [[-16,-11,6.6],[-18,5,6.8],[-13,17,6.3],[17,-10,7],[19,6,7.4],[16,18,6.6],[-5,-18,7.1],[7,-19,6.5]].forEach(([x,z,h],i)=>tree(x,z,h,i+9));
    const matrix=new THREE.Object3D(),rocks=new THREE.InstancedMesh(coarseIco,material('#a5af9b'),48);
    for(let i=0;i<48;i++){const a=random()*Math.PI*2,r=22+random()*13;matrix.position.set(Math.cos(a)*r,.1,Math.sin(a)*r);matrix.rotation.set(random(),random(),random());matrix.scale.set(.3+random()*.8,.2+random()*.5,.3+random()*.65);if(matrix.position.x>-18.3&&matrix.position.x<-.8&&matrix.position.z>-20&&matrix.position.z<-9)matrix.scale.setScalar(0);matrix.updateMatrix();rocks.setMatrixAt(i,matrix.matrix);}scene.add(rocks);
    const river=[];for(let z=-60;z<=65;z+=5)river.push([-23+Math.sin(z*.08)*3,z]);for(let z=65;z>=-60;z-=5)river.push([-29+Math.sin(z*.08)*3,z]);
    const stream=flatShape(river,water.material,.025);stream.userData.dynamicSurface=true;
    for(let i=0;i<12;i++)box(.44,.16,1.2,i%2?'#b69a71':'#c1a87c',8.8+i*.48,.15,9.7);
    for(let i=0;i<36;i++){const z=-12+i*.85+(random()-.5)*.18,x=.3+Math.sin(i*.26)*1.15;const stone=mesh(new THREE.SphereGeometry(1,12,6),'#bdb392',x,.04,z);stone.scale.set(.18+random()*.12,.035,.13+random()*.05);}
    for(const[x,z]of[[18,-11],[-16,18]]){blob(x,.34,z,1.3,.46,.8,'#a0ac9c',scene);blob(x+.9,.24,z+.4,.7,.3,.65,'#b7bfa6',scene);}
  }
  makeTerrain();
  mergeStaticScenery(scene);
  createBoundaryForest(scene);
  const treeRendering = await createFoliage(scene,{THREE,flatMaterial,placements:trees,reduced:state.reduced,assets:[greenTree,orangeTree],grassPatches:[{x:-18,z:-7.5,radius:1.4},{x:-14,z:-7.5,radius:1.2},{x:-13,z:2,radius:1.6},{x:10.8,z:5.1,radius:1.5},{x:-15,z:15.5,radius:1.8},{x:17,z:-11,radius:2.1},{x:20,z:15,radius:2.2},{x:5,z:-16,radius:1.9}]});
  const bird = new THREE.Group(); bird.position.set(0,.025,3); scene.add(bird); bird.add(characterAsset.scene);
  characterAsset.scene.traverse(object => {
    if (!object.isMesh) return;
    const original = object.material;
    object.material = flatMaterial(original.color, { vertexColors: !!object.geometry.attributes.color });
  });
  const body = bird.getObjectByName('body_pivot');
  const head = bird.getObjectByName('head_pivot');
  const leftWing = bird.getObjectByName('left_wing'), rightWing = bird.getObjectByName('right_wing');
  const leftFoot = bird.getObjectByName('left_foot'), rightFoot = bird.getObjectByName('right_foot');
  if (!body || !head || !leftWing || !rightWing || !leftFoot || !rightFoot) throw new Error('Character animation nodes are missing');
  const locomotion = createLocomotion(bird,{onStep:position=>{if(state.speed>.6&&!state.airborne)audio?.play('step',position);}});
  let activityArrival=null;
  function groundHeight(x,z){return Math.max(progression?.getGroundHeight(x,z)||0,x>8.58&&x<14.3&&z>9.1&&z<10.3?.23:0);}
  function moveTo(point,callback=null){
    goal.set(point.x,0,point.z);limitToClearing(goal);activityArrival=callback;
    routeQueue=pathfinder.route(bird.position,goal);state.phase='walking';
    if(!routeQueue.length){state.speed=0;marker.visible=false;return;}
    const first=routeQueue.shift();target.set(first.x,0,first.z);marker.position.set(goal.x,groundHeight(goal.x,goal.z)+.07,goal.z);marker.visible=true;
    if(state.reduced){const last=routeQueue.length?routeQueue[routeQueue.length-1]:first;bird.position.set(last.x,groundHeight(last.x,last.z)+.025,last.z);target.set(last.x,0,last.z);routeQueue=[];activityArrival=null;updateCamera(0,true);callback?.();marker.visible=false;}
  }
  const activities=createActivities(scene,{THREE,flatMaterial,characterTemplate:characterAsset.scene,onSound:(name,position)=>audio?.play(name,position),onBark:(text,speaker='guide')=>{barkUntil=performance.now()/1000+4.2;onBark?.(text,speaker);},onDialogue:topic=>{const value=forcedDialogue||topic;forcedDialogue=null;onDialogue?.(value);},onNavigate,onMove:moveTo});
  const progression=createProgression(scene,{THREE,flatMaterial,onMove:moveTo,onDialogue:topic=>onDialogue?.(topic==='shop'?'need-shovel':topic),onNavigate,onChange:()=>{},onSound:(name,position)=>audio?.play(name,position)});
  pathfinder=createPathfinder({getPages:()=>destinations,getHeight:groundHeight,canJump:()=>progression.getState().jump});
  const mountain=scene.getObjectByName('Rounded northern terraces');
  function cancelActivities(){const seated=activities.getPose()?.kind==='sit';activities.cancel();progression.cancel();activityArrival=null;routeQueue=[];if(seated){bird.position.y=groundHeight(bird.position.x,bird.position.z)+.025;locomotion.reset();}}
  function unlockAudio(){progression.enableAudio();progression.setMuted(!audio?.getState().enabled);}
  function audioChanged(event){progression.setMuted(!event.detail.enabled);}
  document.addEventListener('pointerdown',unlockAudio,true);document.addEventListener('keydown',unlockAudio,true);document.addEventListener('portfolio-audio',audioChanged);
  function jump(){if(!progression.getState().jump)return;if(state.airborne){if(progression.getState().glide&&!state.gliding){state.gliding=true;audio?.play('glide',bird.position);}return;}audio?.play('jump',bird.position);state.airborne=true;state.gliding=false;verticalVelocity=6.2;locomotion.reset();}
  function jumpKey(event){if(event.code==='Space'&&!event.repeat&&!state.paused&&!/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(event.target.tagName)){event.preventDefault();jump();}}
  document.addEventListener('keydown',jumpKey);

  const characterShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.1), flatMaterial('#ffffff', { map:treeRendering.shadowTexture, transparent:true, depthWrite:false }));
  characterShadow.rotation.x = -Math.PI / 2; characterShadow.renderOrder=1; scene.add(characterShadow);
  const marker = mesh(new THREE.RingGeometry(.24,.27,40), flatMaterial('#916344', {side:THREE.DoubleSide,transparent:true,opacity:.5}),0,.06,3); marker.rotation.x=-Math.PI/2; marker.visible=false;

  function roundedShape(w, h, r) {
    const shape = new THREE.Shape(); const x=-w/2, y=-h/2;
    shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);return shape;
  }
  const images = new Map();
  async function getImage(path) { if (!path) return null; if (!images.has(path)) images.set(path,(async()=>{const image=new Image();image.src=asset(path);try{await image.decode();return image;}catch{return null;}})());return images.get(path); }
  function imageCover(ctx, image, x, y, w, h) {
    if(!image)return;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.clip();const s=Math.max(w/image.width,h/image.height);ctx.drawImage(image,x+(w-image.width*s)/2,y+(h-image.height*s)/2,image.width*s,image.height*s);ctx.restore();
  }
  async function pageTexture(def) {
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=Math.round(1536*def.h/def.w);const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    ctx.fillStyle=def.color;ctx.fillRect(0,0,w,h);ctx.fillStyle=def.ink;ctx.font='18px Arial';ctx.fillText('DAVID SVEZHINTSEV',60,52);ctx.textAlign='right';ctx.fillText(def.number, w-60,52);ctx.textAlign='left';
    ctx.strokeStyle=def.ink+'38';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(60,78);ctx.lineTo(w-60,78);ctx.stroke();
    ctx.font='500 108px Arial';ctx.letterSpacing='-5px';
    if(def.id==='games'){ctx.fillText('Technical',60,209);ctx.fillText('game design',60,315);}else if(def.id==='archive'){ctx.fillText('Other case studies',60,218);}else ctx.fillText(def.title,60,218);
    ctx.letterSpacing='0px';
    if(def.projects.length){
      const y=def.id==='games'?365:280, imageH=h-y-115;
      const ids=def.projects.slice(0,def.id==='archive'?3:2),gap=22,previewWidth=(w-120-gap*(ids.length-1))/ids.length;
      for(let i=0;i<ids.length;i++){const p=portfolio.findProject(ids[i]),image=await getImage(portfolio.posterFor(p));imageCover(ctx,image,60+i*(previewWidth+gap),y,previewWidth,imageH);ctx.fillStyle=def.ink;ctx.font='22px Arial';ctx.fillText(p?.heading||ids[i],60+i*(previewWidth+gap),h-65);}
    }else if(def.id==='blog'){
      let y=300;
      for(const post of portfolio.blogPosts().slice(0,3)){
        ctx.fillStyle=def.ink;ctx.font='20px Arial';ctx.fillText(post.date,60,y);y+=50;
        ctx.font='38px Arial';let line='';
        for(const word of post.title.split(' ')){const next=line?line+' '+word:word;if(ctx.measureText(next).width>w-120){ctx.fillText(line,60,y);line=word;y+=48;}else line=next;}
        if(line){ctx.fillText(line,60,y);y+=48;}y+=42;
      }
      ctx.font='22px Arial';ctx.fillText('GAME DEVELOPMENT / CREATIVE PRODUCTION',60,h-65);
    }else if(def.id==='resume'){
      ctx.font='30px Arial';ctx.fillText('Design / Development / Creative direction',60,310);ctx.font='24px Arial';ctx.fillText('KERN',60,410);ctx.fillText('2026 —',w-245,410);ctx.fillText('LIGHTKEEPER',60,473);ctx.fillText('2023 — 2026',w-245,473);ctx.fillText('DRONIES',60,536);ctx.fillText('2021 — 2023',w-245,536);ctx.fillText('Oklahoma / Remote',60,h-70);
    }else{
      ctx.font='28px Arial';const lines=['Tell me what you are making,','breaking, or trying to understand.'];lines.forEach((line,i)=>ctx.fillText(line,60,310+i*40));ctx.font='160px Arial';ctx.fillText('↗',w-240,h-85);ctx.font='22px Arial';ctx.fillText('AVAILABLE FOR SELECT PROJECTS',60,h-70);
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
  }
  for(const def of destinations){
    const group=new THREE.Group();group.position.set(def.x,.18,def.z);scene.add(group);
    const shape=roundedShape(def.w,def.h,.16);
    const slab=mesh(new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSize:.025,bevelThickness:.018,bevelSegments:1,steps:1,curveSegments:5}),def.color,0,-.05,0,group);slab.rotation.x=-Math.PI/2;
    const geometry=new THREE.ShapeGeometry(shape,8),uv=geometry.attributes.uv,position=geometry.attributes.position;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(position.getX(i)+def.w/2)/def.w,(position.getY(i)+def.h/2)/def.h);
    const face=mesh(geometry,flatMaterial('#ffffff',{map:await pageTexture(def)}),0,.10,0,group);face.rotation.x=-Math.PI/2;
    face.userData.page=def.id;slab.userData.page=def.id;
    const shadow=mesh(new THREE.PlaneGeometry(def.w*1.1,def.h*1.1),flatMaterial('#ffffff',{map:treeRendering.shadowTexture,transparent:true,depthWrite:false}),def.x,.023,def.z);shadow.rotation.x=-Math.PI/2;shadow.renderOrder=1;
    cards.push({def,baseDef:{...def},group,face,slab,shadow,lift:0});
  }
  function resize() {
    const aspect=innerWidth/innerHeight, span=aspect<.85?28:20.2;
    const compact=aspect<.85;
    // Separate paper footprints and their projected portrait bounding boxes.
    // Shear the north row left so both main choices retain tappable centers.
    const mobile={product:{x:-5.8,z:-4.4,w:4.7,h:3.3},games:{x:2.5,z:-4.4,w:4.7,h:3.3},archive:{x:-4.8,z:3.5,w:4.5,h:3.1},resume:{x:3.5,z:3.5,w:3.8,h:2.7},blog:{x:-4.8,z:10.8,w:4.5,h:3.1},contact:{x:3.5,z:10.8,w:3.8,h:2.7}};
    for(const card of cards){Object.assign(card.def,card.baseDef,compact?mobile[card.def.id]:{});card.group.position.x=card.def.x;card.group.position.z=card.def.z;card.group.scale.set(card.def.w/card.baseDef.w,1,card.def.h/card.baseDef.h);card.shadow.position.set(card.def.x,.023,card.def.z);card.shadow.scale.set(card.def.w/card.baseDef.w,card.def.h/card.baseDef.h,1);}
    baseSpan=span;currentSpan=0;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
  }
  function updateCamera(dt, snap=false) {
    const lookAhead=state.speed>.3?.65:0;
    cameraGoal.set(bird.position.x+Math.sin(yaw)*lookAhead,Math.max(0,bird.position.y-.025)*.5,bird.position.z+Math.cos(yaw)*lookAhead);
    if(snap||state.reduced)cameraFocus.copy(cameraGoal);else cameraFocus.lerp(cameraGoal,1-Math.exp(-2.4*dt));
    const span=baseSpan*(2.1-1.1*state.intro),aspect=innerWidth/innerHeight;if(Math.abs(currentSpan-span)>.0001){currentSpan=span;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();}cameraOffset.copy(arrivalOffset).lerp(normalOffset,state.intro);camera.position.copy(cameraFocus).add(cameraOffset);camera.lookAt(cameraFocus.x,cameraFocus.y+.2,cameraFocus.z-1.1);camera.updateMatrixWorld();
  }
  function updatePointer(event) {
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);if(raycaster.ray.intersectPlane(ground,scratch))cursorWorld.copy(scratch);
  }
  function hitPage() { return raycaster.intersectObjects(cards.flatMap(card=>[card.face,card.slab]),false)[0]?.object.userData.page||null; }
  function setHover(id) { if(state.hovered===id)return;state.hovered=id;renderer.domElement.style.cursor=id?'pointer':'default';onHover?.(id); }
  function approach(id){const def=destinations.find(d=>d.id===id);if(!def)return;cancelActivities();state.pending=id;liftTime=0;const edge=pageApproach(bird.position,def);moveTo(edge);if(state.reduced){state.pending=null;onSelect(id);}}
  function stop(){target.set(bird.position.x,0,bird.position.z);goal.copy(target);routeQueue=[];state.pending=null;state.speed=0;state.phase='idle';state.hovered=null;marker.visible=false;}
  function pointerMove(event){if(state.paused)return;pointerInside=true;updatePointer(event);setHover(hitPage());}
  function pointerDown(event){
    if(event.button!==0||state.paused)return;
    if(state.intro<1){const act=state.intro>.7;arrival.skip();state.intro=1;updateCamera(0,true);if(!act)return;}
    updatePointer(event);if(state.airborne)jump();
    const elevated=mountain?raycaster.intersectObject(mountain,false)[0]:null;
    const candidates=[...(elevated?[{...elevated,kind:'terrain'}]:[]),...raycaster.intersectObjects(cards.flatMap(c=>[c.face,c.slab]),false).map(hit=>({...hit,kind:'page'})),...raycaster.intersectObjects(treeRendering.targets,false).map(hit=>({...hit,kind:'tree'})),...raycaster.intersectObjects(activities.targets,true).map(hit=>({...hit,kind:'activity'})),...raycaster.intersectObjects(progression.targets,true).map(hit=>({...hit,kind:'progression'}))].sort((a,b)=>a.distance-b.distance);
    const hit=candidates[0];
    if(hit?.kind==='page'){activities.notifyMoveIntent?.(null);approach(hit.object.userData.page);return;}
    if(hit?.kind==='tree'){treeRendering.activate(hit,state.reduced);audio?.play('tree',hit.point);cancelActivities();state.pending=null;const point=elevated?.point||cursorWorld;activities.notifyMoveIntent?.(point);moveTo(point);return;}
    if(hit?.kind==='activity'){if(hit.object.userData.activityId!=='ball')activities.notifyMoveIntent?.(null);const continuing=hit.object.userData.activityId==='fishing'&&activities.getState().fishing!=='idle';if(!continuing)cancelActivities();state.pending=null;activities.activate(hit.object,hit.point);return;}
    if(hit?.kind==='progression'){activities.notifyMoveIntent?.(null);cancelActivities();state.pending=null;progression.activate(hit,hit.point);return;}
    const point=elevated?.point||cursorWorld;
    cancelActivities();state.pending=null;
    activities.notifyMoveIntent?.(point);
    if(state.airborne)jump();
    jumpWanted=progression.getState().jump&&groundHeight(point.x,point.z)>groundHeight(bird.position.x,bird.position.z)+.2;
    if(jumpWanted&&Math.hypot(point.x-bird.position.x,point.z-bird.position.z)<4)jump();
    moveTo(point);
  }
  window.addEventListener('pointermove',pointerMove);
  renderer.domElement.addEventListener('pointerleave',()=>{pointerInside=false;setHover(null);});
  renderer.domElement.addEventListener('pointerdown',pointerDown);
  window.addEventListener('resize',resize);
  resize();updateCamera(0,true);state.ready=true;
  function tick(time) {
    frame=requestAnimationFrame(tick);const dt=Math.min((time-lastTime)/1000,.06)||0;lastTime=time;if(document.hidden||state.paused)return;
    state.intro=arrival.progress(time);
    const t=time/1000,dx=target.x-bird.position.x,dz=target.z-bird.position.z,dist=Math.hypot(dx,dz);
    updateSpeech(dt);
    const walking=!state.paused&&state.phase!=='lifting'&&dist>.035;
    state.speed=damp(state.speed,walking?Math.min(4.8,(routeQueue.length?Math.max(dist,1):dist)*7):0,10,dt);
    if(walking){const step=Math.min(dist,state.speed*dt),nx=bird.position.x+dx/dist*step,nz=bird.position.z+dz/dist*step,current=groundHeight(bird.position.x,bird.position.z),look=Math.min(dist,Math.max(1.0,state.speed*.24)),ahead=groundHeight(bird.position.x+dx/dist*look,bird.position.z+dz/dist*look);if(!state.airborne&&progression.getState().jump&&ahead>current+.28)jump();const next=groundHeight(nx,nz)+.025;if(!(state.airborne&&next>bird.position.y+.06)){bird.position.x=nx;bird.position.z=nz;}yaw+=deltaAngle(yaw,Math.atan2(dx,dz))*(1-Math.exp(-13*dt));cycle+=dt*(9+state.speed*1.4);}
    if(dist<.09&&routeQueue.length){const next=routeQueue.shift();target.set(next.x,0,next.z);}
    else if(dist<.09&&!routeQueue.length&&!state.airborne){
      marker.visible=false;
      if(activityArrival){const callback=activityArrival;activityArrival=null;state.phase='idle';callback();}
      if(state.pending&&state.phase==='walking'){state.phase='lifting';liftTime=0;}else if(!state.pending)state.phase='idle';
    }
    const talkingTo=(state.conversing||t<barkUntil)?activities.getState().objects.find(object=>object.id==='npc'):null;const lookTarget=talkingTo||cursorWorld;const angle=Math.atan2(lookTarget.x-bird.position.x,lookTarget.z-bird.position.z);
    if(!walking&&!state.pending&&!state.paused)yaw+=deltaAngle(yaw,angle)*(1-Math.exp(-1.1*dt));
    lookYaw=damp(lookYaw,THREE.MathUtils.clamp(deltaAngle(yaw,angle),-.9,.9),11,dt);head.rotation.y=lookYaw;head.rotation.x=state.reduced?0:Math.sin(t*1.5)*.025+speechSprings.you.position;
    const swing=walking&&!state.reduced?Math.sin(cycle):0;
    body.position.y=(walking?.62:.65)+(state.reduced?0:walking?Math.abs(Math.sin(cycle))*.012:Math.sin(t*2)*.012);
    body.rotation.set(walking?.055:0,swing*.035,swing*.022);
    // The torso carries the gait. Sleeves follow quietly from anchored pivots.
    leftWing.rotation.set(-swing*.035,0,.018);rightWing.rotation.set(swing*.035,0,-.018);
    if(state.phase==='lifting'){
      liftTime+=dt;const def=destinations.find(d=>d.id===state.pending);yaw+=deltaAngle(yaw,Math.atan2(def.x-bird.position.x,def.z-bird.position.z))*(1-Math.exp(-15*dt));head.rotation.y*=.5;head.rotation.x=-.35;body.rotation.x=.28;leftWing.rotation.z=-.7;rightWing.rotation.z=.7;
      if(liftTime>.55){const id=state.pending;state.pending=null;state.phase='reading';onSelect(id);}
    }
    const floor=groundHeight(bird.position.x,bird.position.z)+.025;
    if(state.airborne){verticalVelocity-=dt*(state.gliding?2.4:11.5);if(state.gliding)verticalVelocity=Math.max(-1.3,verticalVelocity);bird.position.y+=verticalVelocity*dt;if(bird.position.y<=floor&&verticalVelocity<=0){bird.position.y=floor;state.airborne=false;state.gliding=false;verticalVelocity=0;audio?.play('land',bird.position);locomotion.reset();}}
    else bird.position.y=floor;
    progression.update(dt,t,{character:bird.position,yaw,reduced:state.reduced,paused:state.paused,airborne:state.airborne});
    const guide=activities.getState().objects.find(object=>object.id==='npc');if(!greeted&&state.intro===1&&!state.conversing&&guide&&Math.hypot(bird.position.x-guide.x,bird.position.z-guide.z)<4.3){greeted=true;barkUntil=t+4.2;onBark?.();}
    activities.update(dt,t,{character:bird.position,yaw,reduced:state.reduced,paused:state.paused,talking:state.conversing||t<barkUntil,dialogueActive:state.conversing,digging:progression.getState().digging,cursor:cursorWorld,pages:destinations,speechTilt:speechSprings.guide.position});
    const activityPose=activities.getPose(),digPose=progression.getAnimation();
    if(activityPose){bird.position.set(activityPose.position.x,activityPose.position.y,activityPose.position.z);yaw=activityPose.yaw;target.set(bird.position.x,0,bird.position.z);state.speed=0;
      if(activityPose.kind==='fish'){body.rotation.x=.06;const pull=activityPose.phase==='reeling'?Math.sin(t*14)*.18:0;leftWing.rotation.set(-.55+pull,0,-.12);rightWing.rotation.set(-.55+pull,0,.12);}
    }
    if(digPose){bird.position.set(digPose.position.x,digPose.position.y,digPose.position.z);yaw=digPose.yaw;body.rotation.x=.12+Math.max(0,Math.sin(digPose.progress*Math.PI*6))*.3;leftWing.rotation.x=rightWing.rotation.x=-.6+Math.sin(digPose.progress*Math.PI*6)*.4;}
    if(state.airborne){body.rotation.x=state.gliding?.2:.08;leftWing.rotation.z=state.gliding?-1.1:-.35;rightWing.rotation.z=state.gliding?1.1:.35;}
    bird.rotation.y=yaw;
    locomotion.update(dt,{speed:state.speed,yaw,moving:walking&&!activityPose&&!digPose,reduced:state.reduced,paused:state.paused,seated:activityPose?.kind==='sit',airborne:state.airborne,targetSpeed:walking?Math.min(4.8,dist*7):0,groundHeight});
    // Hover lifts the page a few pixels; clicking adds the physical approach gesture.
    for(const card of cards){
      const selected=state.phase==='lifting'&&card.def.id===state.pending;
      card.lift=damp(card.lift,selected?.36:state.hovered===card.def.id?.13:0,9,dt);card.group.position.y=.18+card.lift;
    }
    characterShadow.position.set(bird.position.x+.2,.022,bird.position.z+.1);
    if(marker.visible)marker.scale.setScalar(state.reduced?1:1+Math.sin(t*5)*.12);
    if(!state.paused){
      updateCamera(dt);
      if(pointerInside){raycaster.setFromCamera(pointer,camera);if(raycaster.ray.intersectPlane(ground,scratch))cursorWorld.copy(scratch);setHover(hitPage());}

    }
    const ball=activities.getState().ball.position;treeRendering.update(dt,t,state.reduced,{camera,targets:[bird.position.clone().add(new THREE.Vector3(0,1.2,0)),new THREE.Vector3(ball.x,ball.y,ball.z)]});water.update(t,state.reduced);audio?.update(dt,{character:bird.position,fireLit:activities.getState().fireLit});
    onFrame?.();renderer.render(scene,camera);
  }
  frame=requestAnimationFrame(tick);
  function projectPoint(vector) { const point=vector.clone().project(camera);return{x:(point.x+1)*innerWidth/2,y:(1-point.y)*innerHeight/2}; }
  function pageRect(id) {
    const card=cards.find(c=>c.def.id===id);if(!card)return null;card.group.updateMatrixWorld(true);
    const points=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,z])=>projectPoint(new THREE.Vector3(x*card.baseDef.w/2,.1,z*card.baseDef.h/2).applyMatrix4(card.group.matrixWorld)));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  }
  return {
    approach, pageRect,
    converse(value){state.conversing=value;if(value){cancelActivities();stop();}} ,
    pause(value){if(state.paused===value)return;state.paused=value;progression.setVisible(!value);activities.setVisible?.(!value);audio?.setWorldActive(!value);if(value){cancelAnimationFrame(frame);cancelActivities();stop();}else{lastTime=0;frame=requestAnimationFrame(tick);}},
    setReduced(value){state.reduced=value;},
    getState:()=>({intro:state.intro,conversing:state.conversing,airborne:state.airborne,gliding:state.gliding,goal:{x:goal.x,z:goal.z},waypoints:routeQueue.length,progression:progression.getState(),phase:state.phase,pending:state.pending,hovered:state.hovered,character:{x:bird.position.x,y:bird.position.y,z:bird.position.z,headYaw:head.rotation.y,screen:projectPoint(bird.position.clone().add(new THREE.Vector3(0,1,0)))},target:{x:target.x,z:target.z},camera:{x:cameraFocus.x,z:cameraFocus.z,span:camera.top-camera.bottom},reduced:state.reduced,audio:audio?.getState(),legs:locomotion.getState(),activities:activities.getState(),trees:treeRendering.getState(),hoverLifts:cards.map(c=>({id:c.def.id,lift:c.lift})),render:{frame:renderer.info.render.frame,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,width:renderer.domElement.width,height:renderer.domElement.height}}),
    destinations:()=>cards.map(c=>({id:c.def.id,...pageRect(c.def.id),center:projectPoint(c.group.position),world:{x:c.def.x,z:c.def.z,w:c.def.w,h:c.def.h}})),
    trees:()=>trees.map(tree=>({id:tree.id,height:tree.height,world:{x:tree.x,z:tree.z},...projectPoint(new THREE.Vector3(tree.x,tree.height*.55,tree.z))})),
    activities:()=>activities.getState().objects.map(object=>{const height={bench:.7,ball:.35,campfire:.6,npc:1.25,signpost:1.3,fishing:.52}[object.id]||.6;const offset=object.id==='fishing'?{x:.19,z:.94}:{x:0,z:0};return{...object,world:{x:object.x,z:object.z},...projectPoint(new THREE.Vector3(object.x+offset.x,height,object.z+offset.z))};}),
    groundHeight:(x,z)=>groundHeight(x,z),
    getActions:()=>progression.getActions(),performAction:id=>progression.performAction(id),visitGuide(){forcedDialogue='shop';cancelActivities();state.pending=null;const npc=activities.targets.find(object=>object.userData.activityId==='npc');activities.activate(npc);},
    getSpeechAnchor:(speaker='guide')=>{const actor=speaker==='you'?{x:bird.position.x,z:bird.position.z,height:bird.position.y+2.15}:speaker==='sign'?{x:-2,z:1,height:1.8}:{...activities.getState().objects.find(o=>o.id==='npc'),height:2.35};return projectPoint(new THREE.Vector3(actor.x,actor.height,actor.z));},
    terrainPoint:(x,z)=>projectPoint(new THREE.Vector3(x,groundHeight(x,z),z)),
    groundPoint:(x,z)=>projectPoint(new THREE.Vector3(x,0,z)),
    destroy(){arrival.dispose();progression.dispose();water.dispose();treeRendering.dispose();document.removeEventListener('portfolio-letter',speechLetter);document.removeEventListener('keydown',jumpKey);document.removeEventListener('pointerdown',unlockAudio,true);document.removeEventListener('keydown',unlockAudio,true);document.removeEventListener('portfolio-audio',audioChanged);activities.dispose();window.removeEventListener('pointermove',pointerMove);cancelAnimationFrame(frame);window.removeEventListener('resize',resize);videos.forEach(v=>v.pause());renderer.dispose();renderer.domElement.remove();},
  };
}
