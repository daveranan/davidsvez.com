import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { createLocomotion } from './locomotion.js';

let scoreboardStyles;

const daveGoalLines=[
  'oh yeah! I won! hehehe!',
  'one for the bird.',
  'put that on my résumé.',
  'all skill. please do not inspect it.',
  'the goal and i had an agreement.',
  'a modest victory. mine, specifically.',
  'i have prepared a very small gloat.',
  'i am being extremely normal about this.',
];
const yourGoalLines=[
  'okay. that one was yours.',
  'i was testing the net.',
  'right. you have done this before.',
  'an excellent clerical error.',
  'i will allow it. once.',
  'the ball has chosen a side.',
  'that is going in the report.',
  'hm. inconveniently competent.',
];
const sidelineLines=[
  {guide:'the pitch ends there.',reply:'oh come on.'},
  {guide:'that is a scenic route.',reply:'it was intentional.'},
  {guide:'we have invented hiking.',reply:'i thought that was the website.'},
  {guide:'the trees are not on your team.',reply:'they looked available.'},
  {guide:'a pass to absolutely nobody.',reply:null},
  {guide:'bold use of the entire island.',reply:null},
  {guide:'the ball has gone on a break.',reply:'fair enough.'},
  {guide:'we will call that field research.',reply:null},
];

/** Independent bags exhaust all eight variants before repeating, including
 * across refill boundaries. Injecting random keeps isolated checks repeatable. */
export function createFootballBarkDecks(random=Math.random){
  function bag(values){
    let remaining=[],previous;
    return()=>{
      if(!remaining.length){
        remaining=values.slice();
        for(let i=remaining.length-1;i>0;i--){const j=Math.max(0,Math.min(i,Math.floor(random()*(i+1))));[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}
        const last=remaining.length-1;
        if(remaining.length>1&&remaining[last]===previous)[remaining[0],remaining[last]]=[remaining[last],remaining[0]];
      }
      previous=remaining.pop();return previous;
    };
  }
  return{daveGoal:bag(daveGoalLines),yourGoal:bag(yourGoalLines),sideline:bag(sidelineLines)};
}

/** Physical clearing interactions, including a two-goal match with Dave. */
export function createActivities(scene, { THREE, flatMaterial, characterTemplate, onMove, onDialogue, onNavigate, onSound, onBark, barkRandom=Math.random }) {
  const root = new THREE.Group(); root.name = 'Clearing activities'; scene.add(root);
  const targets = [], geometries = new Set(), materials = new Set(), textures = new Set(), palette = new Map();
  const up = new THREE.Vector3(0, 1, 0), currentCharacter = new THREE.Vector3(0, 0, 3);
  const previousCharacter = currentCharacter.clone(), actorVelocity = new THREE.Vector3(), stepCharacter = new THREE.Vector3();
  const state = { active: null, seated: false, fireLit: true, fishing: 'idle', catches: 0, pushes: 0, pageCollisions: 0, goals:0, soccerIntent:false, score:{you:0,dave:0},resetting:false,resetReason:null,kickoff:false,npcPlaying:false, npcKicks:0 };
  let pageColliders=[],intentEntered=false;
  let pose = null, revision = 0, disposed = false, currentYaw = 0, characterInitialized = false, ballContact = false;
  let soundClock=0;
  const footballBarks=createFootballBarkDecks(barkRandom);
  let pendingReply=null;
  const clearReply=()=>{pendingReply=null;};
  const visibilityChanged=()=>{if(document.hidden)clearReply();};
  document.addEventListener('visibilitychange',visibilityChanged);
  const lastSound=new Map();
  if(!scoreboardStyles?.isConnected){scoreboardStyles=document.createElement('link');scoreboardStyles.rel='stylesheet';scoreboardStyles.href=new URL('./activities.css',import.meta.url).href;document.head.append(scoreboardStyles);}
  const scoreElement=document.createElement('div');scoreElement.className='soccer-score';scoreElement.hidden=true;scoreElement.setAttribute('role','status');scoreElement.setAttribute('aria-live','polite');scoreElement.setAttribute('aria-atomic','true');scoreElement.setAttribute('aria-label','Football score');
  const scoreNumbers={};
  for(const [key,label]of[['you','You'],['dave','Dave']]){if(key==='dave'){const divider=document.createElement('span');divider.className='soccer-score-separator';divider.textContent=' : ';scoreElement.append(divider);}const team=document.createElement('span');team.className='soccer-score-team';team.append(document.createTextNode(label+' '));const value=document.createElement('strong');value.textContent='0';team.append(value);scoreElement.append(team);scoreNumbers[key]=value;}
  document.body.append(scoreElement);
  let scoreAllowed=true,latestPaused=false,resetRemaining=0,kickoffGrace=0;
  function sound(name,position,spacing=.15){
    if(soundClock-(lastSound.get(name)??-100)<spacing)return;
    lastSound.set(name,soundClock);onSound?.(name,{x:position.x,y:position.y||0,z:position.z});
  }

  function material(color, options = {}) {
    const key = color + JSON.stringify(options);
    if (!palette.has(key)) { const value = flatMaterial(color, options); palette.set(key, value); materials.add(value); }
    return palette.get(key);
  }
  function mesh(geometry, color, position = [0, 0, 0], scale = null, parent = root) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, typeof color === 'string' ? material(color) : color);
    object.position.set(...position); if (scale) object.scale.set(...scale); parent.add(object); return object;
  }
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1), roundGeometry = new THREE.SphereGeometry(1, 16, 10);
  function box(position, scale, color, parent) { return mesh(boxGeometry, color, position, scale, parent); }
  function round(position, scale, color, parent) { return mesh(roundGeometry, color, position, scale, parent); }
  function group(name, x, z) { const g = new THREE.Group(); g.name = name; g.position.set(x, 0, z); root.add(g); return g; }
  function tag(object, id, label) {
    object.traverse(child => {
      child.userData.activityId = id; child.userData.activity = id; child.userData.label = label;
      if (child.isMesh || child.isLine || child.isPoints) {
        const raycast = child.raycast;
        child.raycast = function (raycaster, intersections) {
          for (let ancestor = this; ancestor && ancestor !== root.parent; ancestor = ancestor.parent) if (!ancestor.visible) return;
          raycast.call(this, raycaster, intersections);
        };
      }
    });
    targets.push(object); return object;
  }
  function mergeParts(object) {
    const batches = new Map(); object.updateMatrixWorld(true);
    for (const child of [...object.children]) {
      if (!child.isMesh || Array.isArray(child.material)) continue;
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      child.updateMatrix(); geometry.applyMatrix4(child.matrix);
      if (!batches.has(child.material)) batches.set(child.material, []);
      batches.get(child.material).push(geometry); object.remove(child);
    }
    for (const [mat, parts] of batches) {
      const geometry = mergeGeometries(parts);
      if (geometry) mesh(geometry, mat, [0, 0, 0], null, object);
      parts.forEach(g => g.dispose());
    }
  }
  function labelPlane(text, width, height, parent, position, color = '#344b3c') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.font = '600 74px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fontSize = Math.min(74, 74 * 460 / Math.max(1, ctx.measureText(text).width)); ctx.font = `600 ${fontSize}px Arial`; ctx.fillText(text, 256, 100);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const plane = mesh(new THREE.PlaneGeometry(width, height), material('#ffffff', { map: texture, transparent: true, depthWrite: false }), position, null, parent);
    return plane;
  }
  function requestMove(position, callback) {
    const token = ++revision;
    const complete = () => { if (!disposed && token === revision) callback(); };
    if (onMove) onMove(position, complete); else complete();
  }

  // A quiet seat beside the edge of the clearing.
  const bench = group('Bench', -15, 1);
  for (const z of [-.24, 0, .24]) box([0, .65, z], [2.5, .13, .2], '#a78d65', bench);
  for (const x of [-.91, .91]) {
    box([x, .31, 0], [.13, .63, .55], '#77745a', bench);
    box([x, .93, -.32], [.10, .73, .10], '#77745a', bench);
  }
  box([0, 1.04, -.32], [2.5, .30, .11], '#b39c74', bench);
  mergeParts(bench); tag(bench, 'bench', 'Sit on the bench');

  // A small clearing, painted rather than fenced. The goal and ball make its
  // purpose legible before the nearby scoreboard appears.
  const fieldWidth=14,fieldDepth=9,fieldCenter=new THREE.Vector3(-9.5,0,-14.5),field=group('Northern football clearing',fieldCenter.x,fieldCenter.z);
  const fieldCanvas=document.createElement('canvas');fieldCanvas.width=512;fieldCanvas.height=384;
  const fieldContext=fieldCanvas.getContext('2d');fieldContext.fillStyle='#a0b779';fieldContext.fillRect(0,0,512,384);
  for(let i=0;i<6;i++){fieldContext.fillStyle=i%2?'#9bb373':'#a4bb7d';fieldContext.fillRect(i*512/6,0,512/6+1,384);}
  fieldContext.globalCompositeOperation='destination-in';
  for(const horizontal of [true,false]){
    const gradient=fieldContext.createLinearGradient(0,0,horizontal?512:0,horizontal?0:384);gradient.addColorStop(0,'transparent');gradient.addColorStop(.055,'white');gradient.addColorStop(.945,'white');gradient.addColorStop(1,'transparent');fieldContext.fillStyle=gradient;fieldContext.fillRect(0,0,512,384);
  }
  const fieldTexture=new THREE.CanvasTexture(fieldCanvas);fieldTexture.colorSpace=THREE.SRGBColorSpace;textures.add(fieldTexture);
  const grass=mesh(new THREE.PlaneGeometry(14.6,9.6),material('#ffffff',{map:fieldTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),[0,.004,0],null,field);grass.rotation.x=-Math.PI/2;
  const paint=material('#eee9d4',{transparent:true,opacity:.66,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const paintedLine=(x,z,w,d)=>box([x,.012,z],[w,.003,d],paint,field);
  paintedLine(0,-4.3,13.6,.035);paintedLine(0,4.3,13.6,.035);paintedLine(-6.8,0,.035,8.6);paintedLine(6.8,0,.035,8.6);paintedLine(0,0,.035,8.6);
  for(const side of[-1,1]){paintedLine(side*5.7,-2.4,2.2,.035);paintedLine(side*5.7,2.4,2.2,.035);paintedLine(side*4.6,0,.035,4.8);}
  const centerRing=mesh(new THREE.RingGeometry(.97,1.005,64),paint,[0,.014,0],null,field);centerRing.rotation.x=-Math.PI/2;
  const centerSpot=mesh(new THREE.CircleGeometry(.07,20),paint,[0,.015,0],null,field);centerSpot.rotation.x=-Math.PI/2;
  mergeParts(field);
  const goalSegments=[];
  function buildGoal(name,front,back,team){
    const goal={name,front,back,team,left:fieldCenter.z-1.75,right:fieldCenter.z+1.75,height:1.65,direction:Math.sign(back-front),armed:true,pulse:0};
    const group= new THREE.Group();group.name=name+' goal';root.add(group);
    function tube(a,b,radius=.055){
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),difference=end.clone().sub(start);
      const post=mesh(new THREE.CylinderGeometry(radius,radius,difference.length(),12),'#e4ddc2',start.clone().add(end).multiplyScalar(.5).toArray(),null,group);post.quaternion.setFromUnitVectors(up,difference.clone().normalize());
      goalSegments.push({start,end,radius,direction:difference.clone(),lengthSq:difference.lengthSq()});
    }
    for(const z of[goal.left,goal.right]){tube([front,0,z],[front,goal.height,z]);tube([front,goal.height,z],[back,goal.height,z],.035);tube([back,0,z],[back,goal.height,z],.035);}
    tube([front,goal.height,goal.left],[front,goal.height,goal.right]);mergeParts(group);
    const points=[],line=(a,b)=>points.push(...a,...b);
    for(let z=goal.left;z<=goal.right+.01;z+=.25){line([back,0,z],[back,goal.height,z]);line([front,goal.height,z],[back,goal.height,z]);}
    for(let y=.02;y<=goal.height+.01;y+=.22){line([back,y,goal.left],[back,y,goal.right]);for(const z of[goal.left,goal.right])line([front,y,z],[back,y,z]);}
    for(let x=Math.min(back,front);x<=Math.max(back,front)+.01;x+=.25){for(const z of[goal.left,goal.right])line([x,0,z],[x,goal.height,z]);line([x,goal.height,goal.left],[x,goal.height,goal.right]);}
    goal.base=new Float32Array(points);goal.geometry=new THREE.BufferGeometry();goal.geometry.setAttribute('position',new THREE.BufferAttribute(goal.base.slice(),3));geometries.add(goal.geometry);
    goal.material=new THREE.LineBasicMaterial({color:'#e5e6d1',transparent:true,opacity:.55});materials.add(goal.material);
    const net=new THREE.LineSegments(goal.geometry,goal.material);net.frustumCulled=false;group.add(net);return goal;
  }
  const goals=[buildGoal('Left',-16.3,-17.45,'you'),buildGoal('Right',-2.7,-1.55,'dave')],goal=goals[0],attackGoal=goals[1];
  let goalBreak=0;
  const celebrationMaterial=material('#ffffff',{transparent:true,opacity:.85,depthWrite:false}),celebration=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),celebrationMaterial,36);geometries.add(celebration.geometry);celebration.frustumCulled=false;celebration.visible=false;celebration.raycast=()=>{};root.add(celebration);
  const celebrationParts=Array.from({length:36},(_,i)=>({position:new THREE.Vector3(),velocity:new THREE.Vector3(),spin:i*.71,size:.05+(i%4)*.017})),celebrationMatrix=new THREE.Object3D();let celebrationAge=10;
  function burst(scoredGoal){
    celebrationAge=0;celebration.visible=true;
    celebrationParts.forEach((part,i)=>{const angle=i/36*Math.PI*2;part.position.set(scoredGoal.front,.7,fieldCenter.z);part.velocity.set(Math.cos(angle)*1.4-scoredGoal.direction*.7,1.3+(i%5)*.23,Math.sin(angle)*(1+(i%3)*.35));celebration.setColorAt(i,new THREE.Color(['#f2d16c','#d3e6ba','#d78a5f','#f7edcb'][i%4]));});if(celebration.instanceColor)celebration.instanceColor.needsUpdate=true;
  }
  function updateScoreboard(paused=latestPaused){scoreElement.hidden=!scoreAllowed||paused||Math.hypot(currentCharacter.x-fieldCenter.x,currentCharacter.z-fieldCenter.z)>9;}
  function beginReset(reason){
    clearReply();goals.forEach(value=>value.armed=false);resetRemaining=2.5;state.resetting=true;state.resetReason=reason;goalBreak=4;ballVelocity.set(0,0,0);
    if(reason==='out'){const exchange=footballBarks.sideline();onBark?.(exchange.guide,'guide');if(exchange.reply)pendingReply={text:exchange.reply,remaining:1.4};}
  }
  function scoreGoal(scoredGoal){
    state.goals++;state.score[scoredGoal.team]++;scoreNumbers[scoredGoal.team].textContent=String(state.score[scoredGoal.team]);
    scoredGoal.pulse=1;beginReset('goal');burst(scoredGoal);sound('goal',ball.position,2);
    onBark?.(scoredGoal.team==='dave'?footballBarks.daveGoal():footballBarks.yourGoal(),'guide');
  }
  const goalScratchA=new THREE.Vector3(),goalScratchB=new THREE.Vector3(),goalScratchC=new THREE.Vector3(),npcToBall=new THREE.Vector3();

  // One tactile object near the main path, rather than a separate minigame.
  const ball = group('Ball', -9.5, -12.8); ball.position.y = .35;
  mesh(new THREE.SphereGeometry(.34, 20, 12), '#ce7850', [0, 0, 0], null, ball);
  for (const rotation of [[0, 0, 0], [Math.PI / 2, 0, .4]]) {
    const stripe = mesh(new THREE.TorusGeometry(.341, .014, 4, 32), '#f3e7c6', [0, 0, 0], null, ball); stripe.rotation.set(...rotation);
  }
  mergeParts(ball); tag(ball, 'ball', 'Kick the ball');
  const ballVelocity = new THREE.Vector3(), kickDirection = new THREE.Vector3(0, 0, 1);

  // Campfire: a visible, reversible action with particles attached to its source.
  const camp = group('Campfire', -2, -10);
  for (let i = 0; i < 9; i++) {
    const angle = i / 9 * Math.PI * 2;
    round([Math.cos(angle) * .72, .14, Math.sin(angle) * .72], [.21, .15, .19], '#8c9278', camp);
  }
  for (const angle of [-.7, .7]) { const log = mesh(new THREE.CylinderGeometry(.12, .13, 1.15, 12), '#7e6550', [0, .19, 0], null, camp); log.rotation.set(Math.PI / 2, 0, angle); }
  mergeParts(camp);
  const flames = new THREE.Group(); camp.add(flames);
  const flameProfile = [[0,0],[.26,.04],[.37,.22],[.28,.49],[.12,.85],[0,1.2]].map(([x,y]) => new THREE.Vector2(x,y));
  const outerFlame = mesh(new THREE.LatheGeometry(flameProfile, 20), '#da8a40', [0, .20, 0], null, flames);
  const innerFlame = mesh(new THREE.LatheGeometry(flameProfile, 20), '#f3cc66', [.02, .22, .08], [.64,.72,.64], flames);
  const glow = mesh(new THREE.CircleGeometry(1.3, 32), material('#e6b653', { transparent: true, opacity: .10, depthWrite: false }), [0, .018, 0], null, camp); glow.rotation.x = -Math.PI / 2;
  const sparkPositions = new Float32Array(18 * 3), sparkGeometry = new THREE.BufferGeometry(); sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3)); geometries.add(sparkGeometry);
  const sparkMaterial = new THREE.PointsMaterial({ color: '#efcc71', size: 2.6, transparent: true, opacity: .75, depthWrite: false }); materials.add(sparkMaterial);
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial); sparks.frustumCulled = false; camp.add(sparks);
  tag(camp, 'campfire', 'Tend the campfire');
  // Decorative sparks never steal a click from the nearby character.
  sparks.raycast = () => {};

  // The guide is the same authored character family, with a distinct green tunic.
  const npcHome=new THREE.Vector3(-13,0,-13.4),npc=group('Clearing guide',npcHome.x,npcHome.z);
  const previousNPC=npc.position.clone(),npcVelocity=new THREE.Vector3(),stepNPC=new THREE.Vector3(),npcTarget=new THREE.Vector3(),attackDirection=new THREE.Vector3();
  let npcHold=0,npcKickCooldown=0,npcKickVisual=0,npcSpeed=0;
  let npcModel = null;
  if (characterTemplate) {
    const model = characterTemplate.clone(true); npcModel = model; npc.add(model);
    model.traverse(child => { if (child.isMesh && /Tunic|Sleeve/i.test(child.name)) child.material = material('#708f75'); });
  } else {
    round([0, 1.45, 0], [.45, .43, .44], '#414057', npc);
    mesh(new THREE.CylinderGeometry(.22, .31, .72, 16), '#708f75', [0, .80, 0], null, npc);
    for (const side of [-1, 1]) box([side * .14, .23, 0], [.07, .40, .07], '#414057', npc);
  }
  npc.rotation.y = .3;
  const npcBody = npc.getObjectByName('body_pivot');
  const npcBodyRest = npcBody?.position.clone();
  const npcLocomotion=npc.getObjectByName('left_hip')?createLocomotion(npc):null;
  const npcEyes = []; npcModel?.traverse(child => { if (child.isMesh && /eye/i.test(child.name)) npcEyes.push({ object: child, y: child.scale.y }); });
  // A small speech mark makes the NPC's function legible without unsolicited text.
  const speechMark = new THREE.Group(); speechMark.position.set(0, 2.35, 0); speechMark.rotation.y = .42; npc.add(speechMark);
  const speech = mesh(new THREE.CircleGeometry(.21, 24), '#f8f0d9', [0, 0, 0], [1.3, .9, 1], speechMark);
  for (const x of [-.10, 0, .10]) mesh(new THREE.CircleGeometry(.023, 8), '#536e59', [x, 0, .006], null, speechMark);
  tag(npc, 'npc', 'Talk to the guide');

  // Cast -> bite -> reel, visible on the existing dock. It stays optional and local.
  const fishing = group('Fishing rod', 8.3, 8.1);
  box([.17, .28, .82], [.18, .56, .18], '#8e795a', fishing);
  const rodBase = new THREE.Vector3(.20, .32, .68), rodTip = new THREE.Vector3(1.65, 1.65, .30);
  const restingRodBase=rodBase.clone(), restingRodTip=rodTip.clone(), handBase=new THREE.Vector3(.30,1.0,1.0), heldRodTip=new THREE.Vector3();
  let rodHeldBlend=0;
  const rod = mesh(new THREE.CylinderGeometry(.025, .044, rodBase.distanceTo(rodTip), 6), '#6d6852', rodBase.clone().add(rodTip).multiplyScalar(.5).toArray(), null, fishing);
  rod.quaternion.setFromUnitVectors(up, rodTip.clone().sub(rodBase).normalize());
  box([.19, .52, .89], [.76, .52, .09], '#cdbb8c', fishing);
  labelPlane('FISH', .70, .40, fishing, [.19, .52, .943]);
  const bobber = new THREE.Group(); fishing.add(bobber);
  mesh(new THREE.SphereGeometry(.14, 16, 10), '#b9614a', [0, .06, 0], [1, 1.3, 1], bobber);
  mesh(new THREE.SphereGeometry(.14, 16, 10), '#f2ead2', [0, -.05, 0], [1, .65, 1], bobber);
  const ripple = mesh(new THREE.RingGeometry(.16, .185, 32), material('#bed0b7', { transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false }), [0, .06, 0], null, fishing); ripple.rotation.x = -Math.PI / 2;
  const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(17*3), 3)); geometries.add(lineGeometry);
  const lineMaterial = new THREE.LineBasicMaterial({ color: '#d9dfc5', transparent: true, opacity: .8 }); materials.add(lineMaterial);
  const line = new THREE.Line(lineGeometry, lineMaterial); line.frustumCulled = false; fishing.add(line);
  const caughtFish = new THREE.Group(); fishing.add(caughtFish);
  round([0, 0, 0], [.32, .13, .10], '#779c8a', caughtFish);
  const fishTail = mesh(new THREE.ConeGeometry(.16, .22, 3), '#b8c99f', [.32, 0, 0], null, caughtFish); fishTail.rotation.z = -Math.PI / 2;
  round([-.19, .035, .095], [.024, .024, .018], '#344a40', caughtFish);
  let fishTime = 0, caught = false, splashAge = 10;
  const waterPoint = new THREE.Vector3(3.2, .11, .35), castStart = rodTip.clone(), reelStart = new THREE.Vector3(), linePoint = new THREE.Vector3();
  const splashPositions=new Float32Array(12*3),splashGeometry=new THREE.BufferGeometry();splashGeometry.setAttribute('position',new THREE.BufferAttribute(splashPositions,3));geometries.add(splashGeometry);
  const splashMaterial=new THREE.PointsMaterial({color:'#d3e4cc',size:3.4,transparent:true,opacity:.8,depthWrite:false});materials.add(splashMaterial);
  const splash=new THREE.Points(splashGeometry,splashMaterial);splash.frustumCulled=false;fishing.add(splash);splash.visible=false;
  bobber.visible = ripple.visible = line.visible = caughtFish.visible = false;
  tag(fishing, 'fishing', 'Cast or reel the fishing rod');
  splash.raycast=()=>{};
  const raycastLine = line.raycast;
  line.raycast = function (raycaster, intersections) {
    const threshold = raycaster.params.Line.threshold;
    raycaster.params.Line.threshold = .06;
    try { raycastLine.call(this, raycaster, intersections); }
    finally { raycaster.params.Line.threshold = threshold; }
  };

  function stopFishing() {
    state.fishing = 'idle'; fishTime = 0; caught = false;
    bobber.visible = ripple.visible = line.visible = caughtFish.visible = false;
    if(pose?.kind==='fish')pose=null;
  }
  function cancel() {
    clearReply();revision++; pose = null; state.seated = false; state.active = null; npcHold=0; stopFishing();
  }
  function notifyMoveIntent(point){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z)){clearReply();state.soccerIntent=false;state.npcPlaying=false;intentEntered=false;return false;}
    if(Math.hypot(point.x-fieldCenter.x,point.z-fieldCenter.z)>11){state.soccerIntent=false;state.npcPlaying=false;intentEntered=false;return false;}
    const dx=point.x-currentCharacter.x,dz=point.z-currentCharacter.z,lengthSq=dx*dx+dz*dz;
    const t=lengthSq>.0001?Math.max(0,Math.min(1,((ball.position.x-currentCharacter.x)*dx+(ball.position.z-currentCharacter.z)*dz)/lengthSq)):0;
    const passesBall=Math.hypot(currentCharacter.x+dx*t-ball.position.x,currentCharacter.z+dz*t-ball.position.z)<1.1;
    if(Math.hypot(point.x-ball.position.x,point.z-ball.position.z)<2.1||passesBall){state.soccerIntent=true;intentEntered=Math.hypot(currentCharacter.x-fieldCenter.x,currentCharacter.z-fieldCenter.z)<9;}
    return state.soccerIntent;
  }
  function cast() {
    state.active = 'fishing'; state.fishing = 'casting'; fishTime = 0;
    pose={kind:'fish',position:{x:fishing.position.x,y:.025,z:fishing.position.z+1},yaw:Math.PI/2};
    castStart.copy(handBase).add(new THREE.Vector3(Math.sin(-.55)*1.9,Math.cos(-.55)*1.9,0));
    bobber.position.copy(rodTip); bobber.visible = line.visible = true; ripple.visible = false; caughtFish.visible = false;
    sound('cast',fishing.position,.3);
  }
  function reel() {
    caught = state.fishing === 'bite'; if (caught) state.catches++;
    reelStart.copy(bobber.position); state.fishing = 'reeling'; fishTime = 0; ripple.visible = false;
    sound('reel',fishing.position,.3);
  }
  function findId(object) {
    for (let current = object?.object || object; current && current !== root.parent; current = current.parent) if (current.userData?.activityId) return current.userData.activityId;
    return null;
  }
  function kick() {
    kickDirection.set(ball.position.x - currentCharacter.x, 0, ball.position.z - currentCharacter.z);
    if (kickDirection.lengthSq() < .04) kickDirection.set(Math.sin(currentYaw), 0, Math.cos(currentYaw));
    kickDirection.normalize(); ballVelocity.copy(kickDirection).multiplyScalar(5.8); ballVelocity.y = 2.9; state.active = null;
    sound('kick',ball.position,.20);
  }
  function activate(hit) {
    const id = findId(hit); if (!id || disposed) return false;
    clearReply();
    if(id==='ball'&&(state.resetting||state.kickoff))return true;
    if (id === 'fishing' && state.fishing !== 'idle') { if (['waiting', 'bite'].includes(state.fishing)) reel(); return true; }
    cancel(); state.active = id;
    if (id === 'bench') requestMove({ x: -15, z: 1.9 }, () => {
      pose = { kind: 'sit', position: { x: -15, y: .22, z: 1.08 }, yaw: 0 }; state.seated = true;
      sound('interaction',bench.position,.25);
    });
    if (id === 'ball') {
      notifyMoveIntent(ball.position);
      const direction = new THREE.Vector3(ball.position.x - currentCharacter.x, 0, ball.position.z - currentCharacter.z);
      if (direction.lengthSq() < .04) direction.set(Math.sin(currentYaw), 0, Math.cos(currentYaw)); direction.normalize();
      if (direction.lengthSq() && currentCharacter.distanceTo(ball.position) < 1.35) kick();
      else requestMove({ x: ball.position.x - direction.x * .80, z: ball.position.z - direction.z * .80 }, kick);
    }
    if (id === 'campfire') requestMove({ x: -2, z: -8.6 }, () => {
      state.fireLit = !state.fireLit; flames.visible = glow.visible = state.fireLit; sparks.visible = state.fireLit; state.active = null;
      sound('firetoggle',camp.position,.25);
    });
    if (id === 'npc') {
      npcHold=1;
      const approach=new THREE.Vector3(currentCharacter.x-npc.position.x,0,currentCharacter.z-npc.position.z);
      if(approach.lengthSq()<.01)approach.set(0,0,1);approach.normalize().multiplyScalar(1.05);
      requestMove({x:npc.position.x+approach.x,z:npc.position.z+approach.z},()=>{state.active=null;npcHold=.8;sound('interaction',npc.position,.25);onDialogue?.('about');});
    }
    if (id === 'fishing') requestMove({ x:fishing.position.x, z:fishing.position.z+1 }, cast);
    return true;
  }
  function collideBallWithPages() {
    const radius=.34;
    for(const entry of pageColliders){
      const page=entry.def||entry;
      if(!Number.isFinite(page.x)||!Number.isFinite(page.z)||!(page.w>0)||!(page.h>0))continue;
      const minX=page.x-page.w/2,maxX=page.x+page.w/2,minZ=page.z-page.h/2,maxZ=page.z+page.h/2;
      const nearestX=Math.max(minX,Math.min(maxX,ball.position.x)),nearestZ=Math.max(minZ,Math.min(maxZ,ball.position.z));
      const dx=ball.position.x-nearestX,dz=ball.position.z-nearestZ,distance=Math.hypot(dx,dz);
      if(distance>=radius)continue;
      let nx,nz;
      if(distance>.0001){nx=dx/distance;nz=dz/distance;ball.position.x=nearestX+nx*(radius+.002);ball.position.z=nearestZ+nz*(radius+.002);}
      else{
        const sides=[{d:ball.position.x-minX,nx:-1,nz:0,x:minX-radius-.002,z:ball.position.z},{d:maxX-ball.position.x,nx:1,nz:0,x:maxX+radius+.002,z:ball.position.z},{d:ball.position.z-minZ,nx:0,nz:-1,x:ball.position.x,z:minZ-radius-.002},{d:maxZ-ball.position.z,nx:0,nz:1,x:ball.position.x,z:maxZ+radius+.002}];
        const side=sides.sort((a,b)=>a.d-b.d)[0];nx=side.nx;nz=side.nz;ball.position.x=side.x;ball.position.z=side.z;
      }
      const incoming=ballVelocity.x*nx+ballVelocity.z*nz;
      if(incoming<0){ballVelocity.x-=nx*incoming*1.52;ballVelocity.z-=nz*incoming*1.52;ballVelocity.x*=.94;ballVelocity.z*=.94;}
      ball.position.y=Math.max(.35,ball.position.y);state.pageCollisions++;
    }
  }
  function collideGoalSegment(segment){
    const projection=Math.max(0,Math.min(1,goalScratchA.copy(ball.position).sub(segment.start).dot(segment.direction)/segment.lengthSq));
    const closest=goalScratchB.copy(segment.start).addScaledVector(segment.direction,projection),normal=goalScratchC.copy(ball.position).sub(closest),distance=normal.length(),radius=.34+segment.radius;
    if(distance>=radius)return;
    if(distance<.0001)normal.set(0,0,1);else normal.multiplyScalar(1/distance);
    ball.position.copy(closest).addScaledVector(normal,radius+.002);
    const incoming=ballVelocity.dot(normal);if(incoming<0){ballVelocity.addScaledVector(normal,-incoming*1.58);if(incoming<-.5)sound('bounce',ball.position,.16);}
  }
  function collideNetBox(minX,maxX,minY,maxY,minZ,maxZ,netGoal){
    const closest=goalScratchB.set(Math.max(minX,Math.min(maxX,ball.position.x)),Math.max(minY,Math.min(maxY,ball.position.y)),Math.max(minZ,Math.min(maxZ,ball.position.z)));
    const normal=goalScratchC.copy(ball.position).sub(closest),distance=normal.length();if(distance>=.34)return;
    if(distance>.0001){normal.multiplyScalar(1/distance);ball.position.copy(closest).addScaledVector(normal,.342);}
    else{const choices=[{d:ball.position.x-minX,n:new THREE.Vector3(-1,0,0),p:minX-.342,a:'x'},{d:maxX-ball.position.x,n:new THREE.Vector3(1,0,0),p:maxX+.342,a:'x'},{d:ball.position.z-minZ,n:new THREE.Vector3(0,0,-1),p:minZ-.342,a:'z'},{d:maxZ-ball.position.z,n:new THREE.Vector3(0,0,1),p:maxZ+.342,a:'z'}];const side=choices.sort((a,b)=>a.d-b.d)[0];normal.copy(side.n);ball.position[side.a]=side.p;}
    const incoming=ballVelocity.dot(normal);if(incoming<0){ballVelocity.addScaledVector(normal,-incoming*1.68);netGoal.pulse=Math.max(netGoal.pulse,.35);if(incoming<-.65)sound('bounce',ball.position,.18);}
  }
  function collideGoal(oldX){
    goalSegments.forEach(collideGoalSegment);
    for(const value of goals){
      const scoreLine=value.front+value.direction*.34;
      if(value.direction*(ball.position.x-value.front)<-.6)value.armed=true;
      const crossed=value.direction<0?oldX>scoreLine&&ball.position.x<=scoreLine:oldX<scoreLine&&ball.position.x>=scoreLine;
      if(value.armed&&crossed&&ball.position.z>value.left+.34&&ball.position.z<value.right-.34&&ball.position.y<value.height-.15){scoreGoal(value);return;}
      collideNetBox(value.back-.015,value.back+.015,.03,value.height,value.left,value.right,value);
      const minX=Math.min(value.back,value.front),maxX=Math.max(value.back,value.front);
      for(const z of[value.left,value.right])collideNetBox(minX,maxX,.03,value.height,z-.015,z+.015,value);
      collideNetBox(minX,maxX,value.height-.015,value.height+.015,value.left,value.right,value);
    }
  }
  function updateNPCMovement(dt,{talking,digging,reduced}){
    previousNPC.copy(npc.position);npcKickCooldown=Math.max(0,npcKickCooldown-dt);npcKickVisual=Math.max(0,npcKickVisual-dt);npcHold=Math.max(0,npcHold-dt);goalBreak=Math.max(0,goalBreak-dt);
    const blocked=talking||digging||state.active==='npc'||npcHold>0||reduced||state.resetting||state.kickoff;
    const nearField=Math.hypot(currentCharacter.x-fieldCenter.x,currentCharacter.z-fieldCenter.z)<9.5;
    const ballInPlay=Math.abs(ball.position.x-fieldCenter.x)<fieldWidth/2+2&&Math.abs(ball.position.z-fieldCenter.z)<fieldDepth/2+2;
    state.npcPlaying=state.soccerIntent&&nearField&&ballInPlay&&!blocked;
    npcTarget.copy(npcHome);
    if(state.npcPlaying){
      npcTarget.copy(ball.position).addScaledVector(ballVelocity,.16);npcTarget.y=0;
      attackDirection.set(attackGoal.front+attackGoal.direction*.8-npcTarget.x,0,fieldCenter.z-npcTarget.z).normalize();
      npcTarget.addScaledVector(attackDirection,-.69);
      const fromBallX=npc.position.x-ball.position.x,fromBallZ=npc.position.z-ball.position.z;
      if(Math.hypot(fromBallX,fromBallZ)<1.9&&fromBallX*attackDirection.x+fromBallZ*attackDirection.z>-.4){
        const side=Math.sign(fromBallX*attackDirection.z-fromBallZ*attackDirection.x)||1;
        npcTarget.copy(ball.position).addScaledVector(attackDirection,-.8);npcTarget.x+=attackDirection.z*side*1.05;npcTarget.z-=attackDirection.x*side*1.05;
      }
      if(npcTarget.z>goal.left-.45&&npcTarget.z<goal.right+.45)npcTarget.x=Math.max(goal.front+.4,Math.min(attackGoal.front-.4,npcTarget.x));
      if(goalBreak>0)npcTarget.set(fieldCenter.x-.8,0,fieldCenter.z+.7);
    }
    if(blocked){npcSpeed=0;npcVelocity.set(0,0,0);return;}
    const dx=npcTarget.x-npc.position.x,dz=npcTarget.z-npc.position.z,distance=Math.hypot(dx,dz);
    const visitorOnBall=Math.hypot(currentCharacter.x-ball.position.x,currentCharacter.z-ball.position.z)<1.05&&actorVelocity.lengthSq()>.2;
    const desiredSpeed=distance>.12?Math.min(state.npcPlaying?(visitorOnBall?1.2:2.35):1.55,distance*4):0;
    npcSpeed+=(desiredSpeed-npcSpeed)*(1-Math.exp(-8*dt));
    if(distance>.02&&npcSpeed>.02){npc.position.x+=dx/distance*Math.min(distance,npcSpeed*dt);npc.position.z+=dz/distance*Math.min(distance,npcSpeed*dt);const desiredYaw=Math.atan2(dx,dz);npc.rotation.y+=Math.atan2(Math.sin(desiredYaw-npc.rotation.y),Math.cos(desiredYaw-npc.rotation.y))*(1-Math.exp(-8*dt));}
    // Give the visitor space rather than running directly through them.
    const sx=npc.position.x-currentCharacter.x,sz=npc.position.z-currentCharacter.z,separation=Math.hypot(sx,sz);
    if(separation<.68&&separation>.001){npc.position.x=currentCharacter.x+sx/separation*.68;npc.position.z=currentCharacter.z+sz/separation*.68;}
    npcVelocity.subVectors(npc.position,previousNPC).multiplyScalar(dt>.00001?1/dt:0);npcVelocity.y=0;
    if(state.npcPlaying&&npcKickCooldown===0&&goalBreak===0){
      const toBall=npcToBall.set(ball.position.x-npc.position.x,0,ball.position.z-npc.position.z),distanceToBall=toBall.length();
      attackDirection.set(attackGoal.front+attackGoal.direction*.35-ball.position.x,0,fieldCenter.z-ball.position.z).normalize();
      if(!visitorOnBall&&distanceToBall<.80&&distanceToBall>.01&&toBall.normalize().dot(attackDirection)>.5){ballVelocity.copy(attackDirection).multiplyScalar(4.7);ballVelocity.y=.9;npcKickCooldown=1.2;npcKickVisual=.28;state.npcKicks++;sound('kick',ball.position,.22);}
    }
  }
  function updateBall(dt) {
    if(resetRemaining>0){
      resetRemaining=Math.max(0,resetRemaining-dt);ballVelocity.set(0,0,0);
      if(resetRemaining===0){ball.position.set(fieldCenter.x,.35,fieldCenter.z);state.resetting=false;state.resetReason=null;kickoffGrace=1;state.kickoff=true;ballContact=false;goals.forEach(value=>value.armed=false);}
      return;
    }
    if(kickoffGrace>0){kickoffGrace=Math.max(0,kickoffGrace-dt);state.kickoff=kickoffGrace>0;ballVelocity.set(0,0,0);return;}
    const steps = Math.max(1, Math.ceil(dt / .012)), h = dt / steps;
    let touching=false;
    for (let i = 0; i < steps; i++) {
      stepCharacter.lerpVectors(previousCharacter,currentCharacter,(i+1)/steps);
      stepNPC.lerpVectors(previousNPC,npc.position,(i+1)/steps);
      const oldX=ball.position.x;
      ballVelocity.y -= 9.81 * h; ball.position.addScaledVector(ballVelocity, h);
      // A swept horizontal capsule transfers walking velocity to the ball.
      // This is continuous contact, independent of activating/clicking the ball.
      const dx=ball.position.x-stepCharacter.x,dz=ball.position.z-stepCharacter.z;
      const distance=Math.hypot(dx,dz),radius=.64;
      const verticalContact=ball.position.y+.34>stepCharacter.y+.04&&ball.position.y-.34<stepCharacter.y+1.85;
      if(distance<radius&&verticalContact){
        const nx=distance>.001?dx/distance:Math.sin(currentYaw),nz=distance>.001?dz/distance:Math.cos(currentYaw);
        const normalActor=actorVelocity.x*nx+actorVelocity.z*nz,normalBall=ballVelocity.x*nx+ballVelocity.z*nz;
        const closing=normalActor-normalBall;
        ball.position.x=stepCharacter.x+nx*(radius+.003);ball.position.z=stepCharacter.z+nz*(radius+.003);
        if(closing>0){
          const desired=Math.min(8,normalActor+closing*.22);
          ballVelocity.x+=nx*(desired-normalBall);ballVelocity.z+=nz*(desired-normalBall);
          if(!ballContact&&!touching&&actorVelocity.lengthSq()>.2)ballVelocity.y=Math.max(ballVelocity.y,Math.min(1.3,.25+closing*.12));
        }
        if(!ballContact&&!touching&&actorVelocity.lengthSq()>.2){state.pushes++;sound('kick',ball.position,.24);}
        touching=true;
      }
      const npcDx=ball.position.x-stepNPC.x,npcDz=ball.position.z-stepNPC.z,npcDistance=Math.hypot(npcDx,npcDz);
      if(npcDistance<.64&&ball.position.y<1.35){
        const nx=npcDistance>.001?npcDx/npcDistance:0,nz=npcDistance>.001?npcDz/npcDistance:-1;
        ball.position.x=stepNPC.x+nx*.643;ball.position.z=stepNPC.z+nz*.643;
        const incoming=ballVelocity.x*nx+ballVelocity.z*nz,npcNormal=npcVelocity.x*nx+npcVelocity.z*nz;
        if(incoming<npcNormal){ballVelocity.x+=nx*(npcNormal-incoming)*1.1;ballVelocity.z+=nz*(npcNormal-incoming)*1.1;}
      }
      if (ball.position.y < .35) {
        ball.position.y = .35;
        if(ballVelocity.y<-1.25)sound('bounce',ball.position,.16);
        if (ballVelocity.y < -.28) ballVelocity.y *= -.53; else ballVelocity.y = 0;
        const friction = Math.exp(-2.1 * h); ballVelocity.x *= friction; ballVelocity.z *= friction;
      }
      for (const axis of ['x', 'z']) {
        if (Math.abs(ball.position[axis]) > 24) { ball.position[axis] = Math.sign(ball.position[axis]) * 24; ballVelocity[axis] *= -.65; }
      }
      // Bounded substeps plus circle/AABB separation stop tunnelling through
      // paper footprints. Pages are barriers, never alternate rolling floors.
      collideBallWithPages();
      collideGoal(oldX);
      // A valid right-goal crossing is handled above at x=-2.36. Anything
      // continuing past this runoff limit must not disappear into the hill.
      const eastRunoff=ball.position.x>-2.12;
      if(!state.resetting&&(Math.abs(ball.position.x-fieldCenter.x)>fieldWidth/2+.34||Math.abs(ball.position.z-fieldCenter.z)>fieldDepth/2+.34||eastRunoff))beginReset('out');
      if(state.resetting)break;
    }
    ballContact=touching;
    if (ballVelocity.lengthSq() < .005 && ball.position.y <= .351) ballVelocity.set(0, 0, 0);
    ball.rotation.x += ballVelocity.z * dt / .34; ball.rotation.z -= ballVelocity.x * dt / .34;
  }
  function updateFishing(dt, time, reduced) {
    const active=state.fishing!=='idle';
    rodHeldBlend+=(active?1-rodHeldBlend:-rodHeldBlend)*(1-Math.exp(-12*dt));
    let rodAngle=.68;
    if(active)fishTime+=dt;
    if(state.fishing==='casting'){
      const t=Math.min(1,fishTime/1.0);
      rodAngle=t<.25?.68+(-.55-.68)*(t/.25):t<.58?-.55+1.6*((t-.25)/.33):1.05-.37*((t-.58)/.42);
    }else if(state.fishing==='bite')rodAngle+=reduced?0:Math.sin(time*7)*.08;
    else if(state.fishing==='reeling')rodAngle=.68-.95*Math.min(1,fishTime/.75);
    heldRodTip.copy(handBase).add(new THREE.Vector3(Math.sin(rodAngle)*1.9,Math.cos(rodAngle)*1.9,0));
    rodBase.lerpVectors(restingRodBase,handBase,rodHeldBlend);rodTip.lerpVectors(restingRodTip,heldRodTip,rodHeldBlend);
    rod.position.copy(rodBase).add(rodTip).multiplyScalar(.5);linePoint.subVectors(rodTip,rodBase);
    rod.scale.y=linePoint.length()/rod.geometry.parameters.height;rod.quaternion.setFromUnitVectors(up,linePoint.normalize());
    if (state.fishing === 'casting') {
      const t=Math.min(1,fishTime/1.0);
      if(t<.25)bobber.position.copy(rodTip);
      else{const flight=(t-.25)/.75;bobber.position.lerpVectors(castStart,waterPoint,flight);bobber.position.y+=Math.sin(flight*Math.PI)*1.35;}
      if(t===1){state.fishing='waiting';fishTime=0;ripple.visible=true;splashAge=0;}
    } else if (state.fishing === 'waiting' || state.fishing === 'bite') {
      bobber.position.copy(waterPoint);bobber.position.y+=reduced?0:Math.sin(time*(state.fishing==='bite'?11:2.2))*(state.fishing==='bite'?.13:.025);
      if(state.fishing==='waiting'&&fishTime>3){state.fishing='bite';fishTime=0;splashAge=0;sound('bite',fishing.position,.5);}
      ripple.scale.setScalar(state.fishing==='bite'?reduced?2:1.9+Math.sin(time*6)*.35:1.25);
      ripple.position.set(waterPoint.x,.06,waterPoint.z);
    } else if (state.fishing === 'reeling') {
      const t=Math.min(1,fishTime/.85),catchPoint=handBase.clone().add(new THREE.Vector3(.45,.35,0));
      bobber.position.lerpVectors(reelStart,catchPoint,t);bobber.position.y+=Math.sin(t*Math.PI)*1.05;
      caughtFish.visible=caught;caughtFish.position.copy(bobber.position);caughtFish.position.y-=.15;caughtFish.rotation.z=reduced?0:Math.sin(time*13)*.24;
      if(caught&&fishTime>1.05){
        const release=Math.min(1,(fishTime-1.05)/.65);caughtFish.position.lerpVectors(catchPoint,waterPoint,release);caughtFish.position.y+=Math.sin(release*Math.PI)*.8;
        if(release===1){caughtFish.visible=false;if(splashAge>1)splashAge=0;}
      }
      if(fishTime>1.9){stopFishing();state.active=null;}
    }
    splashAge+=dt;splash.visible=splashAge<.8&&!reduced;
    if(splash.visible){
      for(let i=0;i<12;i++){const angle=i/12*Math.PI*2,distance=splashAge*(.5+(i%3)*.25);splashPositions[i*3]=waterPoint.x+Math.cos(angle)*distance;splashPositions[i*3+1]=.12+Math.sin(Math.min(1,splashAge/.8)*Math.PI)*(.25+(i%3)*.08);splashPositions[i*3+2]=waterPoint.z+Math.sin(angle)*distance;}
      splashGeometry.attributes.position.needsUpdate=true;splashMaterial.opacity=.8*(1-splashAge/.8);
    }
    if(active){
      const positions=lineGeometry.attributes.position;
      for(let i=0;i<17;i++){const t=i/16;linePoint.lerpVectors(rodTip,bobber.position,t);linePoint.y-=Math.sin(t*Math.PI)*.18;positions.setXYZ(i,linePoint.x,linePoint.y,linePoint.z);}positions.needsUpdate=true;
    }
  }
  function update(dt, time, { character, velocity, characterVelocity, pages, cursor, yaw = 0, reduced = false, paused = false, talking = false, digging = false, speechTilt = 0, dialogueActive = false } = {}) {
    if (disposed) return;
    const position = character?.position || character; if (position && Number.isFinite(position.x)) currentCharacter.copy(position);
    const fieldDistance=Math.hypot(currentCharacter.x-fieldCenter.x,currentCharacter.z-fieldCenter.z);
    if(state.soccerIntent&&fieldDistance<9)intentEntered=true;
    if(state.soccerIntent&&intentEntered&&fieldDistance>11){state.soccerIntent=false;intentEntered=false;}
    currentYaw = yaw;
    if(Array.isArray(pages))pageColliders=pages;
    speechMark.visible=!talking;
    dt = Math.min(Math.max(dt, 0), .1);latestPaused=paused;updateScoreboard(paused);
    if(!characterInitialized){previousCharacter.copy(currentCharacter);characterInitialized=true;}
    if(dialogueActive)clearReply();
    if(paused){clearReply();previousCharacter.copy(currentCharacter);previousNPC.copy(npc.position);actorVelocity.set(0,0,0);npcVelocity.set(0,0,0);state.npcPlaying=false;return;}
    soundClock+=dt;
    const suppliedVelocity=velocity||characterVelocity;
    if(suppliedVelocity&&Number.isFinite(suppliedVelocity.x))actorVelocity.copy(suppliedVelocity);
    else actorVelocity.subVectors(currentCharacter,previousCharacter).multiplyScalar(dt>.00001?1/dt:0);
    actorVelocity.y=0;
    if(currentCharacter.distanceToSquared(previousCharacter)>4||actorVelocity.lengthSq()>144){previousCharacter.copy(currentCharacter);actorVelocity.set(0,0,0);}
    updateNPCMovement(dt,{talking,digging,reduced});updateBall(dt); updateFishing(dt, time, reduced);
    previousCharacter.copy(currentCharacter);
    const turn = Math.atan2(currentCharacter.x - npc.position.x, currentCharacter.z - npc.position.z);
    if(talking||!state.npcPlaying&&currentCharacter.distanceTo(npc.position)<5)npc.rotation.y+=Math.atan2(Math.sin(turn-npc.rotation.y),Math.cos(turn-npc.rotation.y))*(1-Math.exp(-3*dt));
    const head=npc.getObjectByName('head_pivot');
    if(head){
      const gaze=talking?{x:currentCharacter.x,y:currentCharacter.y+1.35,z:currentCharacter.z}:cursor||currentCharacter;
      const gazeAngle=Math.atan2(gaze.x-npc.position.x,gaze.z-npc.position.z),relative=Math.atan2(Math.sin(gazeAngle-npc.rotation.y),Math.cos(gazeAngle-npc.rotation.y));
      const desiredYaw=Math.max(-.9,Math.min(.9,relative)),distance=Math.hypot(gaze.x-npc.position.x,gaze.z-npc.position.z);
      const desiredPitch=Math.max(-.25,Math.min(.35,Math.atan2(npc.position.y+1.49-(gaze.y||0),Math.max(.3,distance))*.5));
      head.rotation.y+=(desiredYaw-head.rotation.y)*(1-Math.exp(-9*dt));head.rotation.x+=(desiredPitch+(reduced?0:speechTilt)-head.rotation.x)*(1-Math.exp(-25*dt));
    }
    if(npcBody&&npcBodyRest){npcBody.position.copy(npcBodyRest);if(!reduced){const phase=time*(6+npcSpeed*2.5);npcBody.position.y+=npcSpeed>.15?Math.abs(Math.sin(phase))*.025:Math.sin(time*1.8)*.012;npcBody.rotation.z=Math.sin(npcSpeed>.15?phase:time*.9)*.022;npcBody.rotation.x=(npcSpeed>.15?.05:0)+npcKickVisual*.25;}}
    // Conversation stops travel, but the feet may still replant during an
    // in-place turn so the guide does not twist crossed legs under the body.
    npcLocomotion?.update(dt,{speed:npcSpeed,yaw:npc.rotation.y,moving:npcVelocity.lengthSq()>.02,reduced,paused:false,targetSpeed:npcSpeed});
    const blinkPhase=time%5.4,blink=reduced||blinkPhase> .18?1:Math.max(.08,Math.abs(blinkPhase-.09)/.09);
    npcEyes.forEach(eye=>eye.object.scale.y=eye.y*blink);
    speechMark.rotation.y = .42 - npc.rotation.y;
    for(const value of goals){
      const oldPulse=value.pulse;value.pulse*=Math.exp(-3.1*dt);
      if(oldPulse>.003){
        const positions=value.geometry.attributes.position;
        for(let i=0;i<positions.count;i++){
          const x=value.base[i*3],y=value.base[i*3+1],z=value.base[i*3+2],heightWeight=Math.sin(Math.PI*Math.max(0,Math.min(1,y/value.height))),backWeight=Math.max(0,Math.min(1,(x-value.front)/(value.back-value.front)));
          positions.setXYZ(i,x+(reduced?0:value.direction*Math.sin(time*14+z*1.8)*value.pulse*.15*heightWeight*backWeight),y,z);
        }
        positions.needsUpdate=true;value.material.opacity=.55+value.pulse*.18;
      }
    }
    celebrationAge+=dt;celebration.visible=celebrationAge<1.8&&!reduced;
    if(celebration.visible){
      celebrationParts.forEach((part,i)=>{part.velocity.y-=2.8*dt;part.position.addScaledVector(part.velocity,dt);celebrationMatrix.position.copy(part.position);celebrationMatrix.rotation.set(-.65,.42,part.spin+celebrationAge*2);celebrationMatrix.scale.setScalar(part.size*Math.max(0,1-celebrationAge/1.8));celebrationMatrix.updateMatrix();celebration.setMatrixAt(i,celebrationMatrix.matrix);});celebration.instanceMatrix.needsUpdate=true;
    }
    updateScoreboard();
    if(pendingReply){pendingReply.remaining-=dt;if(pendingReply.remaining<=0){const text=pendingReply.text;pendingReply=null;onBark?.(text,'you');}}
    if (state.fireLit) {
      flames.visible = glow.visible = true; sparks.visible = !reduced;
      outerFlame.scale.set(1, reduced ? 1 : 1 + Math.sin(time * 4.1) * .08, 1); innerFlame.scale.set(.64, .72*(reduced ? 1 : 1 + Math.sin(time * 3.3 + 1) * .10), .64);
      outerFlame.rotation.z=reduced?0:Math.sin(time*2.1)*.055;innerFlame.rotation.z=reduced?0:Math.sin(time*2.4+1)*.07;
      glow.material.opacity=reduced?.10:.10+Math.sin(time*3.1)*.018;
      if (!reduced) {
        for (let i = 0; i < 18; i++) { const phase = (time * .31 + i / 18) % 1, angle = i * 2.4 + phase * .7; sparkPositions[i * 3] = Math.cos(angle) * (.08 + phase * .19); sparkPositions[i * 3 + 1] = .6 + phase * 1.8; sparkPositions[i * 3 + 2] = Math.sin(angle) * (.08 + phase * .19); }
        sparkGeometry.attributes.position.needsUpdate = true;
      }
    } else flames.visible = glow.visible = sparks.visible = false;
  }
  return {
    targets, activate, update, cancel,notifyMoveIntent,
    setVisible(visible){scoreAllowed=!!visible;if(!visible)clearReply();updateScoreboard();},
    getPose: () => pose ? { kind: pose.kind, position: { ...pose.position }, yaw: pose.yaw, phase:state.fishing } : null,
    getState: () => ({ ...state,score:{...state.score}, field:{x:fieldCenter.x,z:fieldCenter.z,width:fieldWidth,height:fieldDepth,goalAxis:'x',goalX:goal.front,goalLeft:goal.left,goalRight:goal.right,netPulse:Math.max(...goals.map(value=>value.pulse)),goals:goals.map(value=>({team:value.team,axis:'x',x:value.front,z:fieldCenter.z,back:value.back,lower:value.left,upper:value.right}))},npc:{x:npc.position.x,z:npc.position.z,speed:npcSpeed,headYaw:npc.getObjectByName('head_pivot')?.rotation.y||0}, ball: { position: { x: ball.position.x, y: ball.position.y, z: ball.position.z }, velocity: ballVelocity.length() }, rod:{held:rodHeldBlend,tip:{x:rodTip.x+fishing.position.x,y:rodTip.y,z:rodTip.z+fishing.position.z}}, objects: targets.map(target => ({ id: target.userData.activityId, label: target.userData.label, x: target.position.x, z: target.position.z })) }),
    dispose() { if (disposed) return; disposed = true; cancel();document.removeEventListener('visibilitychange',visibilityChanged);scoreElement.remove(); root.removeFromParent(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(mat => mat.dispose()); textures.forEach(texture => texture.dispose()); targets.length = 0; },
  };
}
