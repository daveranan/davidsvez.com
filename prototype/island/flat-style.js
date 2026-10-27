import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// A shared unlit shader: stable palette colors, distance fog, and low-lying haze.
// There are no screen-space filters, shadow-map passes, dithering, or alpha hashes.
export function flatMaterial(color, options = {}) {
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false, ...options });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vLandscapePosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      vec4 landscapePosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        landscapePosition = instanceMatrix * landscapePosition;
      #endif
      vLandscapePosition = (modelMatrix * landscapePosition).xyz;
    `);
    shader.fragmentShader = 'varying vec3 vLandscapePosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
      #include <fog_fragment>
      float lowFog = exp(-max(vLandscapePosition.y + 0.3, 0.0) * 0.65);
      float distant = smoothstep(35.0, 92.0, length(cameraPosition - vLandscapePosition));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.78, 0.84, 0.76), lowFog * distant * 0.24);
      float boundary = smoothstep(26.5, 36.5, length(vLandscapePosition.xz));
      boundary = max(boundary, 1.0 - smoothstep(-2.6, -0.15, vLandscapePosition.y));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.137, 0.2, 0.196), boundary);
    `);
  };
  material.customProgramCacheKey = () => 'landscape-flat-height-fog-v1';
  return material;
}

export function mergeStaticScenery(scene) {
  const batches = new Map();
  scene.updateMatrixWorld(true);
  for (const object of [...scene.children]) {
    if (!object.isMesh || object.isInstancedMesh || Array.isArray(object.material)) continue;
    const geometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(object.matrixWorld);
    // Only the common attributes are needed by the unlit terrain materials.
    for (const name of Object.keys(geometry.attributes)) if (!['position','uv'].includes(name)) geometry.deleteAttribute(name);
    const key = object.material.uuid;
    if (!batches.has(key)) batches.set(key, { material: object.material, geometries: [] });
    batches.get(key).geometries.push(geometry);
    scene.remove(object);
  }
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries);
    if (geometry) scene.add(new THREE.Mesh(geometry, batch.material));
    batch.geometries.forEach(g => g.dispose());
  }
}

export function plantTrees(scene, assets, placements) {
  placements.forEach((p,index)=>p.id=index);
  const targets=[],batches=[],shakes=new Map(),leaves=[];
  const matrix = new THREE.Object3D();
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const ctx = shadowCanvas.getContext('2d'), gradient = ctx.createRadialGradient(32,32,4,32,32,30);
  gradient.addColorStop(0,'rgba(46,62,67,.21)'); gradient.addColorStop(1,'rgba(46,62,67,0)'); ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = flatMaterial('#ffffff', { map: shadowTexture, transparent: true, depthWrite: false });
  const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1), shadowMaterial, placements.length);
  for (let i=0;i<placements.length;i++) {
    const p=placements[i];matrix.position.set(p.x+.35,.012,p.z+.25);matrix.rotation.set(-Math.PI/2,0,0);matrix.scale.set(p.height*.75,p.height*.5,1);matrix.updateMatrix();shadows.setMatrixAt(i,matrix.matrix);
  }
  shadows.renderOrder=1;scene.add(shadows);
  assets.forEach((asset,index) => {
    const locations=placements.filter(p=>p.variant===index);asset.scene.updateMatrixWorld(true);
    asset.scene.traverse(object=>{
      if(!object.isMesh)return;
      const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
      if(index===2&&geometry.attributes.color&&/canopy/i.test(object.name)){
        const colors=geometry.attributes.color,palette=['#527b62','#638c69','#7e9b70'].map(color=>new THREE.Color(color));
        for(let i=0;i<colors.count;i++){const value=colors.getX(i),color=palette[value>.65?2:value>.46?1:0];colors.setXYZ(i,color.r,color.g,color.b);}
      }
      const material=flatMaterial('#ffffff',{vertexColors:!!geometry.attributes.color,side:THREE.DoubleSide});
      const instances=new THREE.InstancedMesh(geometry,material,locations.length);
      locations.forEach((p,i)=>{matrix.position.set(p.x,0,p.z);matrix.rotation.set(0,p.angle,0);matrix.scale.setScalar(p.height);matrix.updateMatrix();instances.setMatrixAt(i,matrix.matrix);});
      instances.computeBoundingSphere();scene.add(instances);
      instances.userData.treeLocations=locations;targets.push(instances);batches.push({instances,locations});
    });
  });
  const leafMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(.16,.095),flatMaterial('#dba35d',{side:THREE.DoubleSide}),72);leafMesh.frustumCulled=false;scene.add(leafMesh);
  for(let i=0;i<72;i++){leaves.push({life:0});matrix.scale.setScalar(0);matrix.updateMatrix();leafMesh.setMatrixAt(i,matrix.matrix);}
  function activate(hit,reduced=false){
    if(reduced)return;
    const p=hit.object.userData.treeLocations?.[hit.instanceId];if(!p)return;
    shakes.set(p.id,{p,time:0});
    let count=0;
    for(const leaf of leaves){if(leaf.life>0)continue;const a=Math.random()*Math.PI*2,r=Math.random()*p.height*.18;Object.assign(leaf,{life:3+Math.random()*2,x:p.x+Math.cos(a)*r,y:p.height*(.55+Math.random()*.3),z:p.z+Math.sin(a)*r,vx:(Math.random()-.5)*.6,vz:(Math.random()-.5)*.6,rotation:Math.random()*6});if(++count===18)break;}
  }
  function update(dt,time){
    const active=shakes.size>0||leaves.some(leaf=>leaf.life>0);leafMesh.visible=active;if(!active)return;
    for(const [id,shake] of shakes){shake.time+=dt;const p=shake.p,tilt=Math.sin(shake.time*26)*.055*Math.max(0,1-shake.time/.65);
      for(const {instances,locations} of batches){const index=locations.findIndex(location=>location.id===id);if(index<0)continue;matrix.position.set(p.x,0,p.z);matrix.rotation.set(0,p.angle,tilt);matrix.scale.setScalar(p.height);matrix.updateMatrix();instances.setMatrixAt(index,matrix.matrix);instances.instanceMatrix.needsUpdate=true;}
      if(shake.time>.65)shakes.delete(id);
    }
    for(let i=0;i<leaves.length;i++){const leaf=leaves[i];if(leaf.life>0){leaf.life-=dt;leaf.y-=dt*.65;leaf.x+=dt*(leaf.vx+Math.sin(time*3+i)*.18);leaf.z+=dt*leaf.vz;if(leaf.y<.08)leaf.life=0;matrix.position.set(leaf.x,leaf.y,leaf.z);matrix.rotation.set(Math.sin(time*4+i),leaf.rotation+time,Math.cos(time*3+i));matrix.scale.setScalar(Math.min(1,leaf.life*2));}else matrix.scale.setScalar(0);matrix.updateMatrix();leafMesh.setMatrixAt(i,matrix.matrix);}leafMesh.instanceMatrix.needsUpdate=true;
  }
  return { shadowTexture,targets,activate,update,getState:()=>({shaking:shakes.size,leaves:leaves.filter(leaf=>leaf.life>0).length}) };
}

export function groundWords(scene, notes) {
  const created=[];
  for(const note of notes){
    const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=460;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#435e50';ctx.font='500 58px Arial';
    note.lines.forEach((line,index)=>ctx.fillText(line,25,100+index*77));
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(note.width,note.width*460/1400),flatMaterial('#ffffff',{map:texture,transparent:true,depthWrite:false}));
    plane.position.set(note.x,.025,note.z);plane.rotation.set(-Math.PI/2,0,note.angle||0);plane.renderOrder=2;scene.add(plane);created.push(plane);
  }
  return created;
}
