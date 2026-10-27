import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// Port of supplied LookLab/diorama.gd tree construction and fade.gdshader.
// The clearing radius is enlarged for the portfolio; tree shapes, height fog,
// base-fog rise (1.8), sink progression and background color retain source values.
export const FOREST_EDGE=25.5;
export function limitToClearing(point) {
  const length=Math.hypot(point.x,point.z);
  if(length>FOREST_EDGE){point.x*=FOREST_EDGE/length;point.z*=FOREST_EDGE/length;}
  return point;
}
function forestMaterial(color) {
  const material=new THREE.MeshBasicMaterial({color,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float baseY; attribute float groundFog; varying vec3 wpos; varying float vBaseY; varying float vGroundFog;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 p=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
      p=instanceMatrix*p;
      #endif
      wpos=(modelMatrix*p).xyz;vBaseY=baseY;vGroundFog=groundFog;`);
    shader.fragmentShader='varying vec3 wpos; varying float vBaseY; varying float vGroundFog;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`
      float f=smoothstep(26.5,36.5,length(wpos.xz));
      f=max(f,1.0-smoothstep(-2.6,-0.15,wpos.y));
      f=max(f,vGroundFog*(1.0-smoothstep(vBaseY,vBaseY+1.8,wpos.y)));
      gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(0.137,0.2,0.196),f);`);
  };
  material.customProgramCacheKey=()=> 'looklab-forest-port-v1';return material;
}
export function createBoundaryForest(scene) {
  let seed=840;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  const matrix=new THREE.Object3D();
  for(let variant=0;variant<3;variant++){
    const height=1.7+variant*.55,layers=3+variant%2,parts=[];
    for(let i=0;i<layers;i++){
      const f=i/layers,radius=THREE.MathUtils.lerp(.62,.22,f),coneHeight=height*.42;
      const geometry=new THREE.ConeGeometry(radius,coneHeight,7,1);geometry.rotateY(i*.7);geometry.translate(0,.4+f*height*.72+coneHeight*.5,0);parts.push(geometry);
    }
    const canopy=mergeGeometries(parts);parts.forEach(g=>g.dispose());
    const trunk=new THREE.CylinderGeometry(.06,.1,.6,6,1);trunk.translate(0,.3,0);
    const locations=[];
    for(let ring=1;ring<=4;ring++)for(let i=0;i<72;i++){
      if(i%3!==variant)continue;
      const a=i/72*Math.PI*2+(random()-.5)*.045,radius=26.5+ring*1.8+random()*1.2;
      locations.push({x:Math.cos(a)*radius,z:Math.sin(a)*radius,y:-(1+.55*ring+(random()-.5)*.6),angle:random()*Math.PI*2,scale:(1.1+random()*.6)*1.45,ground:.65+ring*.06});
    }
    for(const [geometry,color] of [[canopy,'#293f35'],[trunk,'#3d2b1f']]){
      geometry.setAttribute('baseY',new THREE.InstancedBufferAttribute(new Float32Array(locations.map(p=>p.y)),1));
      geometry.setAttribute('groundFog',new THREE.InstancedBufferAttribute(new Float32Array(locations.map(p=>p.ground)),1));
      const mesh=new THREE.InstancedMesh(geometry,forestMaterial(color),locations.length);
      locations.forEach((p,i)=>{matrix.position.set(p.x,p.y,p.z);matrix.rotation.set(0,p.angle,0);matrix.scale.setScalar(p.scale);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);});
      mesh.computeBoundingSphere();scene.add(mesh);
    }
  }
}
