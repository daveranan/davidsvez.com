import { GLTFLoader } from './vendor/GLTFLoader.js';

const textureUrl = name => new URL(`./assets/foliage/${name}`, import.meta.url).href;
const defaults = [
  { x:-14, z:-10, radius:2.0 }, { x:-11, z:-8.5, radius:1.5 },
  { x:-13, z:2, radius:1.6 }, { x:10.8, z:5.1, radius:1.5 },
  { x:-15, z:15.5, radius:1.8 }, { x:17, z:-11, radius:2.1 },
  { x:20, z:15, radius:2.2 }, { x:5, z:-16, radius:1.9 },
];

function seeded(seed = 9187) {
  return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
}

function windMaterial(THREE, flatMaterial, color, options, mode, uniforms) {
  const material = flatMaterial(color, options);
  const originalCompile = material.onBeforeCompile;
  const originalKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    originalCompile.call(material, shader, renderer);
    shader.uniforms.foliageTime = uniforms.time;
    shader.uniforms.foliageMotion = uniforms.motion;
    shader.vertexShader = `
      attribute vec4 foliageData;
      attribute float foliageVisibility;
      varying float vFoliageVisibility;
      uniform float foliageTime;
      uniform float foliageMotion;
    ` + shader.vertexShader;
    const common = `
      float foliageWave = sin(foliageTime * 0.85 + foliageData.x);
      float foliageCross = sin(foliageTime * 0.57 + foliageData.x * 0.71);
    `;
    const movement = mode === 'grass' ? `
      float tipWeight = pow(clamp(position.y, 0.0, 1.0), 1.6);
      transformed.x += (foliageWave * 0.19 + foliageCross * 0.07) * tipWeight * foliageMotion;
      transformed.z += foliageCross * 0.10 * tipWeight * foliageMotion;
    ` : mode === 'canopy' ? `
      transformed.x += foliageWave * 0.023 * foliageMotion;
      transformed.y += foliageCross * 0.012 * foliageMotion;
      transformed.z += sin(foliageTime * 0.69 + foliageData.x) * 0.006 * foliageMotion;
    ` : `
      float treeWeight = pow(clamp(position.y, 0.0, 1.0), 2.0);
      transformed.x += foliageWave * 0.013 * treeWeight * foliageMotion;
      transformed.z += foliageCross * 0.008 * treeWeight * foliageMotion;
    `;
    shader.fragmentShader='varying float vFoliageVisibility;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n diffuseColor.a *= vFoliageVisibility;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFoliageVisibility=foliageVisibility;\n' + common + movement);
  };
  material.customProgramCacheKey = () => `${originalKey()}-painted-${mode}-v2`;
  return material;
}

async function texture(THREE, name) {
  const map = await new THREE.TextureLoader().loadAsync(textureUrl(name));
  map.colorSpace = THREE.SRGBColorSpace;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.anisotropy = 4;
  return map;
}

function instancePhases(THREE, geometry, entries) {
  const data = new Float32Array(entries.length * 4);
  entries.forEach((entry, index) => {
    const p = entry.placement || entry;
    data[index * 4] = p.x * .16 + p.z * .12;
    data[index * 4 + 1] = p.id || index;
  });
  geometry.setAttribute('foliageData', new THREE.InstancedBufferAttribute(data, 4));
  geometry.setAttribute('foliageVisibility',new THREE.InstancedBufferAttribute(new Float32Array(entries.length).fill(1),1));
}

export async function addGrass(scene, { THREE, flatMaterial, patches = defaults, reduced = false } = {}) {
  const random = seeded(923), matrix = new THREE.Object3D();
  const uniforms = { time:{ value:0 }, motion:{ value:reduced ? 0 : 1 } };
  const map = await texture(THREE, 'grass-tuft.png');
  const entries = [];
  for (const patch of patches) {
    const count = patch.count || 12;
    for (let i=0;i<count;i++) {
      const angle=random()*Math.PI*2, radius=Math.sqrt(random())*patch.radius;
      const x=patch.x+Math.cos(angle)*radius, z=patch.z+Math.sin(angle)*radius;
      const height=.28+random()*.13, width=.70+random()*.20;
      const orientation=random()*Math.PI;
      entries.push({x,z,height,width,angle:orientation},{x,z,height:height*.92,width:width*.9,angle:orientation+Math.PI/2});
    }
  }
  const geometry = new THREE.PlaneGeometry(1,1,1,3); geometry.translate(0,.5,0);
  instancePhases(THREE, geometry, entries);
  const material = windMaterial(THREE,flatMaterial,'#ffffff',{map,alphaTest:.32,alphaToCoverage:true,side:THREE.DoubleSide},'grass',uniforms);
  const mesh = new THREE.InstancedMesh(geometry,material,entries.length);
  entries.forEach((p,i)=>{matrix.position.set(p.x,.045,p.z);matrix.rotation.set(0,p.angle,0);matrix.scale.set(p.width,p.height,1);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);});
  mesh.computeBoundingSphere();scene.add(mesh);
  return {
    update(dt,time,isReduced=reduced){uniforms.time.value=time;uniforms.motion.value=isReduced?0:1;},
    getState:()=>({patches:patches.length,tufts:entries.length/2,wind:uniforms.motion.value}),
    dispose(){scene.remove(mesh);geometry.dispose();material.dispose();map.dispose();},
  };
}

export async function createFoliage(scene, { THREE, flatMaterial, placements, shadowTexture = null, reduced = false, assets = [], grassPatches = defaults } = {}) {
  const random=seeded(317), matrix=new THREE.Object3D(), targets=[], batches=[];
  const uniforms={time:{value:0},motion:{value:reduced?0:1}},shakes=new Map();
  const ownedGeometries=new Set(), ownedMaterials=new Set(), ownedTextures=new Set();
  const maps=await Promise.all(['canopy-sage.png','canopy-amber.png','canopy-cedar.png'].map(name=>texture(THREE,name)));
  maps.forEach(map=>ownedTextures.add(map));
  const masks=maps.map(map=>{
    const canvas=document.createElement('canvas');canvas.width=map.image.width;canvas.height=map.image.height;
    const context=canvas.getContext('2d');context.drawImage(map.image,0,0);
    return {width:canvas.width,height:canvas.height,data:context.getImageData(0,0,canvas.width,canvas.height).data};
  });
  if(!assets.length){const loader=new GLTFLoader();assets=await Promise.all(['lightkeeper-tree.glb','lightkeeper-bushy.glb'].map(name=>loader.loadAsync(new URL(`./assets/${name}`,import.meta.url).href)));}
  const trees=placements.map((p,index)=>({...p,id:p.id??index,angle:p.angle||0}));
  if(!shadowTexture){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,3,32,32,30);
    gradient.addColorStop(0,'rgba(44,63,59,.24)');gradient.addColorStop(1,'rgba(44,63,59,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    shadowTexture=new THREE.CanvasTexture(canvas);ownedTextures.add(shadowTexture);
  }
  const shadowGeometry=new THREE.PlaneGeometry(1,1),shadowMaterial=flatMaterial('#ffffff',{map:shadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const shadows=new THREE.InstancedMesh(shadowGeometry,shadowMaterial,trees.length);
  trees.forEach((p,i)=>{matrix.position.set(p.x+.25,.019,p.z+.18);matrix.rotation.set(-Math.PI/2,0,p.angle);matrix.scale.set(p.height*.84,p.height*.66,1);matrix.updateMatrix();shadows.setMatrixAt(i,matrix.matrix);});
  shadows.renderOrder=1;shadows.computeBoundingSphere();scene.add(shadows);ownedGeometries.add(shadowGeometry);ownedMaterials.add(shadowMaterial);

  function canopyIndex(p){return p.variant===1?1:p.id%4===0?2:0;}
  function setMatrix(entry, tilt=0) {
    const p=entry.placement;
    if(entry.canopy){
      matrix.position.set(p.x+entry.dx+tilt*p.height*.75,entry.y,p.z+entry.dz+tilt*p.height*.22);
      matrix.rotation.set(-Math.PI/2+entry.tilt+tilt*.24,0,p.angle+entry.turn+tilt*.18);
      matrix.scale.set(entry.width,entry.depth,1);
    }else{matrix.position.set(p.x,0,p.z);matrix.rotation.set(0,p.angle,tilt);matrix.scale.setScalar(p.height);}
    matrix.updateMatrix();return matrix.matrix;
  }
  for(let variant=0;variant<3;variant++){
    const entries=[];
    for(const p of trees.filter(p=>canopyIndex(p)===variant)){
      const slender=variant===2,width=p.height*(slender?.73:.98);
      entries.push(
        {placement:p,canopy:true,dx:-width*.18,dz:width*.08,y:p.height*.69,width:width*.77,depth:width*.76,turn:.35,tilt:.035,tone:.89},
        {placement:p,canopy:true,dx:width*.16,dz:width*.04,y:p.height*.77,width:width*.80,depth:width*.79,turn:0,tilt:-.025,tone:.95},
        {placement:p,canopy:true,dx:-width*.02,dz:-width*.06,y:p.height*.91,width:width*.76,depth:width*.72,turn:-.28,tilt:.02,tone:1.03},
      );
    }
    if(!entries.length)continue;
    const geometry=new THREE.PlaneGeometry(1,1,3,3);instancePhases(THREE,geometry,entries);
    const material=windMaterial(THREE,flatMaterial,'#ffffff',{map:maps[variant],alphaTest:.32,alphaToCoverage:false,transparent:true,depthWrite:true,side:THREE.DoubleSide},'canopy',uniforms);
    const mesh=new THREE.InstancedMesh(geometry,material,entries.length);
    // Invisible corners of a leaf card must not intercept clicks on the ground.
    const originalRaycast=mesh.raycast.bind(mesh),mask=masks[variant];
    mesh.raycast=(raycaster,intersections)=>{
      const hits=[];originalRaycast(raycaster,hits);
      for(const hit of hits){
        if(!hit.uv)continue;
        const x=Math.min(mask.width-1,Math.max(0,Math.floor(hit.uv.x*mask.width)));
        const y=Math.min(mask.height-1,Math.max(0,Math.floor((1-hit.uv.y)*mask.height)));
        if(mask.data[(y*mask.width+x)*4+3]>=82&&(entries[hit.instanceId]?.placement.opacity??1)>.65)intersections.push(hit);
      }
    };
    entries.forEach((entry,i)=>{mesh.setMatrixAt(i,setMatrix(entry));mesh.setColorAt(i,new THREE.Color().setScalar(entry.tone));});
    mesh.userData.treeLocations=entries.map(entry=>entry.placement);mesh.computeBoundingSphere();scene.add(mesh);targets.push(mesh);batches.push({mesh,entries});ownedGeometries.add(geometry);ownedMaterials.add(material);
  }
  // Preserve the user's Lightkeeper trunk and branch shapes beneath the cards.
  const trunkAsset=assets[1]||assets[0];trunkAsset.scene.updateMatrixWorld(true);
  trunkAsset.scene.traverse(object=>{
    if(!object.isMesh||!/trunk/i.test(object.name))return;
    const entries=trees.map(placement=>({placement,canopy:false}));
    const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);instancePhases(THREE,geometry,entries);
    const material=windMaterial(THREE,flatMaterial,'#ffffff',{vertexColors:!!geometry.attributes.color,transparent:true,depthWrite:true},'trunk',uniforms);
    const mesh=new THREE.InstancedMesh(geometry,material,entries.length);
    entries.forEach((entry,i)=>mesh.setMatrixAt(i,setMatrix(entry)));
    mesh.userData.treeLocations=trees;mesh.computeBoundingSphere();scene.add(mesh);targets.push(mesh);batches.push({mesh,entries});ownedGeometries.add(geometry);ownedMaterials.add(material);
  });
  const grass=grassPatches===false?null:await addGrass(scene,{THREE,flatMaterial,patches:grassPatches,reduced});

  const ambientCount=56,burstCount=32,leaves=[];
  const leafGeometry=new THREE.PlaneGeometry(1,1),leafMaterial=flatMaterial('#ffffff',{side:THREE.DoubleSide});
  const leafMesh=new THREE.InstancedMesh(leafGeometry,leafMaterial,ambientCount+burstCount);
  leafMesh.frustumCulled=false;scene.add(leafMesh);ownedGeometries.add(leafGeometry);ownedMaterials.add(leafMaterial);
  const colors=['#c7ab69','#9eae6e','#ba8157','#d39b61','#789777'].map(color=>new THREE.Color(color));
  function resetAmbient(leaf,initial=false){
    Object.assign(leaf,{active:true,ambient:true,x:(random()-.5)*50,y:initial?.65+random()*7:5+random()*3,z:(random()-.5)*48,vx:.06+random()*.12,vy:-.08-random()*.07,vz:(random()-.5)*.13,size:.095+random()*.065,phase:random()*Math.PI*2,age:0});
  }
  for(let i=0;i<ambientCount+burstCount;i++){
    const leaf={active:false,ambient:i<ambientCount};if(leaf.ambient)resetAmbient(leaf,true);leaves.push(leaf);leafMesh.setColorAt(i,colors[i%colors.length]);
  }
  function activate(hit,isReduced=reduced){
    const p=hit?.object?.userData?.treeLocations?.[hit.instanceId]||hit?.placement;
    if(!p||isReduced)return false;
    shakes.set(p.id,{placement:p,elapsed:0});let spawned=0;
    for(const leaf of leaves){
      if(leaf.ambient||leaf.active)continue;
      const angle=random()*Math.PI*2,radius=random()*p.height*.24;
      Object.assign(leaf,{active:true,ambient:false,x:p.x+Math.cos(angle)*radius,y:p.height*(.65+random()*.25),z:p.z+Math.sin(angle)*radius,vx:(random()-.5)*.7,vy:.12+random()*.3,vz:(random()-.5)*.6,size:.11+random()*.08,phase:random()*Math.PI*2,age:0});
      if(++spawned===16)break;
    }
    return true;
  }
  const sightRay=new THREE.Ray(),viewDirection=new THREE.Vector3(),crownPoint=new THREE.Vector3(),origin=new THREE.Vector3();
  function update(dt,time,isReduced=reduced,visibility={}){
    if(visibility.camera){viewDirection.set(0,0,-1).applyQuaternion(visibility.camera.quaternion);for(const tree of trees){let obscures=false;crownPoint.set(tree.x,tree.height*.78,tree.z);for(const target of visibility.targets||[]){origin.copy(target).addScaledVector(viewDirection,-100);sightRay.set(origin,viewDirection);if(crownPoint.clone().sub(target).dot(viewDirection)<0&&sightRay.distanceSqToPoint(crownPoint)<(tree.height*.46)**2){obscures=true;break;}}tree.opacity=(tree.opacity??1)+((obscures?.14:1)-(tree.opacity??1))*(isReduced?1:1-Math.exp(-8*dt));}for(const batch of batches){const attr=batch.mesh.geometry.attributes.foliageVisibility;batch.entries.forEach((entry,i)=>attr.setX(i,entry.placement.opacity??1));attr.needsUpdate=true;}}
    dt=Math.min(Math.max(dt,0),.08);uniforms.time.value=time;uniforms.motion.value=isReduced?0:1;grass?.update(dt,time,isReduced);leafMesh.visible=!isReduced;
    if(isReduced)return;
    for(const [id,shake] of shakes){
      shake.elapsed+=dt;const envelope=Math.max(0,1-shake.elapsed/.9),tilt=Math.sin(shake.elapsed*21)*.045*envelope*envelope;
      for(const batch of batches){let changed=false;batch.entries.forEach((entry,i)=>{if(entry.placement.id!==id)return;batch.mesh.setMatrixAt(i,setMatrix(entry,tilt));changed=true;});if(changed)batch.mesh.instanceMatrix.needsUpdate=true;}
      if(shake.elapsed>=.9)shakes.delete(id);
    }
    for(let i=0;i<leaves.length;i++){
      const leaf=leaves[i];
      if(leaf.active){
        leaf.age+=dt;
        const wind=.16+Math.sin(time*.31)*.09,updraft=Math.pow(Math.max(0,Math.sin(time*.51+leaf.phase+leaf.x*.09)),3)*.42;
        leaf.vx+=(wind+Math.sin(time*.83+leaf.phase)*.09-leaf.vx)*(1-Math.exp(-dt*1.4));
        leaf.vz+=(Math.cos(time*.37+leaf.phase)*.11-leaf.vz)*(1-Math.exp(-dt*.8));
        leaf.vy=Math.max(-.37,Math.min(.24,leaf.vy+(-.17+updraft)*dt));
        leaf.x+=leaf.vx*dt;leaf.y+=leaf.vy*dt;leaf.z+=leaf.vz*dt;
        if(leaf.ambient&&(leaf.y<.16||Math.abs(leaf.x)>28||Math.abs(leaf.z)>28))resetAmbient(leaf);
        if(!leaf.ambient&&(leaf.y<.07||leaf.age>7.5))leaf.active=false;
        matrix.position.set(leaf.x,Math.max(.07,leaf.y),leaf.z);matrix.rotation.set(time*.95+leaf.phase,Math.sin(time*1.4+leaf.phase)*.75,time*.51+leaf.phase);matrix.scale.setScalar(leaf.active?leaf.size:0);
      }else matrix.scale.setScalar(0);
      matrix.updateMatrix();leafMesh.setMatrixAt(i,matrix.matrix);
    }
    leafMesh.instanceMatrix.needsUpdate=true;
  }
  update(0,0,reduced);
  return {
    shadowTexture,targets,activate,update,
    getState:()=>({trees:trees.length,canopyLayers:trees.length*3,shaking:shakes.size,ambientLeaves:leaves.filter(leaf=>leaf.ambient&&leaf.active).length,interactiveLeaves:leaves.filter(leaf=>!leaf.ambient&&leaf.active).length,leaves:leaves.filter(leaf=>leaf.active).length,grass:grass?.getState(),wind:uniforms.motion.value,fadedTrees:trees.filter(tree=>(tree.opacity??1)<.9).length}),
    dispose(){grass?.dispose();for(const batch of batches)scene.remove(batch.mesh);scene.remove(shadows,leafMesh);ownedGeometries.forEach(geometry=>geometry.dispose());ownedMaterials.forEach(material=>material.dispose());ownedTextures.forEach(map=>map.dispose());},
  };
}
