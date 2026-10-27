import * as THREE from './vendor/three.module.js';

const UP=new THREE.Vector3(0,1,0);
const clamp=THREE.MathUtils.clamp;

// Original browser implementation of alternating ground-target steps and a
// two-bone leg solver. Feet remain in world space during each stance phase.
export function createLocomotion(root,{onStep}={}) {
  const forward=new THREE.Vector3(),hip=new THREE.Vector3(),desired=new THREE.Vector3();
  const axis=new THREE.Vector3(),bend=new THREE.Vector3(),knee=new THREE.Vector3();
  const aLocal=new THREE.Vector3(),bLocal=new THREE.Vector3(),direction=new THREE.Vector3();
  const orientation=new THREE.Quaternion(),inverse=new THREE.Quaternion();
  let initialized=false,preferred=0;
  const legs=['left','right'].map((side,index)=>{
    const hip=root.getObjectByName(side+'_hip'),thigh=root.getObjectByName(side+'_thigh'),shin=root.getObjectByName(side+'_shin'),foot=root.getObjectByName(side+'_foot');
    if(!hip||!thigh||!shin||!foot)throw new Error('Missing articulated leg: '+side);
    thigh.geometry.computeBoundingBox();shin.geometry.computeBoundingBox();
    return {index,hip,thigh,shin,foot,upperRest:thigh.geometry.boundingBox.max.y-thigh.geometry.boundingBox.min.y,lowerRest:shin.geometry.boundingBox.max.y-shin.geometry.boundingBox.min.y,upper:.255,lower:.245,position:new THREE.Vector3(),from:new THREE.Vector3(),to:new THREE.Vector3(),progress:1,duration:.18,stepping:false};
  });
  function setSegment(object,a,b,restLength){
    object.parent.worldToLocal(aLocal.copy(a));object.parent.worldToLocal(bLocal.copy(b));
    object.position.copy(aLocal).add(bLocal).multiplyScalar(.5);
    direction.subVectors(bLocal,aLocal);const length=direction.length();
    object.quaternion.setFromUnitVectors(UP,direction.normalize());object.scale.set(1,length/restLength,1);
  }
  function reset(){initialized=false;legs.forEach(leg=>{leg.stepping=false;leg.progress=1;});}
  function update(dt,{speed,yaw,moving,reduced=false,paused=false,seated=false,airborne=false,targetSpeed=speed,groundHeight=()=>0}){
    root.updateMatrixWorld(true);forward.set(Math.sin(yaw),0,Math.cos(yaw));orientation.setFromAxisAngle(UP,yaw);
    if(!initialized){for(const leg of legs){leg.foot.getWorldPosition(leg.position);leg.position.y=groundHeight(leg.position.x,leg.position.z)+.08;}initialized=true;}
    for(const leg of legs){
      leg.hip.getWorldPosition(hip);desired.set(hip.x,groundHeight(hip.x,hip.z)+.08,hip.z);leg.airborne=airborne;
      if(seated)desired.set(leg.index===0?-.145:.145,.08,.26).applyMatrix4(root.matrixWorld);
      if(airborne)desired.set(leg.index===0?-.145:.145,.13,.03).applyMatrix4(root.matrixWorld);
      const other=legs[1-leg.index],distance=leg.position.distanceTo(desired);
      const canStep=!other.stepping;
      if(!airborne&&!seated&&!leg.stepping&&!paused&&!reduced&&canStep&&((moving&&distance>.055+speed*.01)||(!moving&&distance>.14))){
        if(leg.index===preferred||!moving||distance>.32){
          leg.duration=clamp(.20-speed*.021,.095,.20);
          const predictedTravel=targetSpeed*leg.duration+(speed-targetSpeed)*(1-Math.exp(-10*leg.duration))/10;
          leg.from.copy(leg.position);leg.to.copy(desired).addScaledVector(forward,moving?predictedTravel+.18:0);
          leg.to.y=groundHeight(leg.to.x,leg.to.z)+.08;
          leg.progress=0;leg.stepping=true;preferred=1-leg.index;
        }
      }
      if(reduced||seated||airborne){leg.position.copy(desired);leg.stepping=false;leg.progress=1;}
      if(leg.stepping){
        leg.progress=Math.min(1,leg.progress+dt/leg.duration);const t=leg.progress,s=t*t*(3-2*t);
        leg.position.lerpVectors(leg.from,leg.to,s);leg.position.y+=Math.sin(Math.PI*t)*(.09+Math.min(.05,speed*.012));
        if(t===1){leg.stepping=false;leg.position.y=leg.to.y;if(moving)onStep?.(leg.position);}
      }
      // If movement or a sharp turn outruns a planted leg, start its recovery
      // instead of stretching the model or dragging an entire rigid leg.
      const reach=leg.upper+leg.lower-.002;
      direction.subVectors(leg.position,hip);const originalDistance=direction.length();
      // Never pull a stance target upward: brief acceleration recovery is
      // absorbed by the lower leg, while its foot remains on the floor.
      if(originalDistance>reach+.025&&!leg.stepping&&canStep&&!paused&&!seated&&!airborne){
        leg.from.copy(leg.position);leg.duration=.095;
        leg.to.copy(desired).addScaledVector(forward,moving?targetSpeed*leg.duration+.18:0);
        leg.to.y=groundHeight(leg.to.x,leg.to.z)+.08;
        leg.progress=0;leg.stepping=true;preferred=1-leg.index;
      }
      axis.subVectors(leg.position,hip);const distanceToFoot=clamp(axis.length(),.02,reach);axis.normalize();
      const along=(leg.upper*leg.upper-leg.lower*leg.lower+distanceToFoot*distanceToFoot)/(2*distanceToFoot);
      const height=Math.sqrt(Math.max(0,leg.upper*leg.upper-along*along));
      bend.copy(forward).addScaledVector(axis,-forward.dot(axis)).normalize();
      knee.copy(hip).addScaledVector(axis,along).addScaledVector(bend,height);
      setSegment(leg.thigh,hip,knee,leg.upperRest);setSegment(leg.shin,knee,leg.position,leg.lowerRest);
      leg.foot.parent.worldToLocal(aLocal.copy(leg.position));leg.foot.position.copy(aLocal);
      leg.foot.parent.getWorldQuaternion(inverse).invert();leg.foot.quaternion.copy(inverse).multiply(orientation);
    }
  }
  return {update,reset,getState:()=>legs.map(leg=>({side:leg.index===0?'left':'right',planted:!leg.stepping&&!leg.airborne,progress:leg.progress,x:leg.position.x,y:leg.position.y,z:leg.position.z}))};
}
