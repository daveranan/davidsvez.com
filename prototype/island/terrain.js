import * as THREE from './vendor/three.module.js';
import {flatMaterial} from './flat-style.js';

const glslColor=color=>new THREE.Color(color).toArray().map(v=>v.toFixed(6)).join(',');
const noise=`
float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(terrainHash(i),terrainHash(i+vec2(1,0)),f.x),mix(terrainHash(i+vec2(0,1)),terrainHash(i+1.0),f.x),f.y);}
float softPatch(vec2 p,vec2 c,vec2 r){float d=length((p-c)/r);d+=(terrainNoise(p*.7)-.5)*.14;return 1.0-smoothstep(.86,1.05,d);}
`;
export function createGround(scene){
  const material=flatMaterial('#ffffff');const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{previous(shader);shader.fragmentShader=noise+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    vec2 p=vLandscapePosition.xz;
    float field=terrainNoise(p*.1)*.6+terrainNoise(p*.28)*.4;
    vec3 dirt=mix(vec3(${glslColor('#e4d493')}),vec3(${glslColor('#eddea5')}),smoothstep(.45,.72,field)*.5);
    vec3 grass=mix(vec3(${glslColor('#a6bc72')}),vec3(${glslColor('#bdca82')}),smoothstep(.35,.65,field));
    float clearing=1.0-smoothstep(.89,1.04,length(p/vec2(25.5,26.5))+(terrainNoise(p*.16)-.5)*.1);
    float patches=softPatch(p,vec2(-10.,1.5),vec2(5.8,1.7));
    patches=max(patches,softPatch(p,vec2(-9.,-11.),vec2(6.,2.9)));
    patches=max(patches,softPatch(p,vec2(11.,5.),vec2(3.5,1.25)));
    patches=max(patches,softPatch(p,vec2(-15.,13.),vec2(3.2,4.0)));
    patches=max(patches,softPatch(p,vec2(19.,-7.),vec2(4.5,5.0)));
    patches=max(patches,softPatch(p,vec2(18.,17.),vec2(5.0,4.0)));
    diffuseColor.rgb=mix(grass,mix(dirt,grass,patches),clearing);
  `);};material.customProgramCacheKey=()=> 'single-soft-painted-ground-v1';
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),material);ground.rotation.x=-Math.PI/2;ground.position.y=0;scene.add(ground);return ground;
}

export async function createWater(scene){
  const loader=new THREE.TextureLoader();
  const [normal,foam]=await Promise.all(['water-normal.png','water-foam.png'].map(file=>loader.loadAsync(new URL('./assets/environment/'+file,import.meta.url).href)));
  for(const texture of [normal,foam]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;}
  const clock={value:0},material=flatMaterial('#ffffff');const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous(shader);Object.assign(shader.uniforms,{waterTime:clock,waterNormal:{value:normal},waterFoam:{value:foam}});
    shader.fragmentShader='uniform float waterTime;uniform sampler2D waterNormal;uniform sampler2D waterFoam;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 uv=vLandscapePosition.xz*.16;
      vec2 flow=texture2D(waterNormal,uv+vec2(waterTime*.018,-waterTime*.012)).rg-.5;
      float a=texture2D(waterFoam,uv*.65+flow*.06+vec2(-waterTime*.009,waterTime*.007)).r;
      float b=texture2D(waterNormal,uv*.7+vec2(-waterTime*.012,waterTime*.016)).b;
      vec3 water=mix(vec3(${glslColor('#739d98')}),vec3(${glslColor('#97bbb0')}),clamp(a*.7+b*.25,0.,1.));
      float shore=length((vLandscapePosition.xz-vec2(13.,8.8))/vec2(3.4,2.65));
      float rim=smoothstep(.78,1.0,shore)*(1.0-smoothstep(1.0,1.1,shore));
      water=mix(water,vec3(${glslColor('#cfdec2')}),rim*.35+smoothstep(.82,.94,a)*.14);
      diffuseColor.rgb=water;
    `);
  };material.customProgramCacheKey=()=> 'lightkeeper-soft-water-v1';
  const control=[];for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=1+.045*Math.sin(i*2.7);control.push(new THREE.Vector3(13+Math.cos(a)*3.4*r,0,8.8+Math.sin(a)*2.65*r));}
  const curve=new THREE.CatmullRomCurve3(control,true,'centripetal'),points=curve.getPoints(96),shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
  const pond=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);pond.rotation.x=-Math.PI/2;pond.position.y=.025;scene.add(pond);
  return{material,update(time,reduced=false){clock.value=reduced?0:time;},dispose(){normal.dispose();foam.dispose();pond.geometry.dispose();material.dispose();pond.removeFromParent();}};
}
