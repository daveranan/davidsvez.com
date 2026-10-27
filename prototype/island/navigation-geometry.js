export function distanceToPage(point, page) {
  return Math.hypot(Math.max(0,Math.abs(point.x-page.x)-page.w/2),Math.max(0,Math.abs(point.z-page.z)-page.h/2));
}

export function pageApproach(point,page,margin=.6) {
  const minX=page.x-page.w/2,maxX=page.x+page.w/2,minZ=page.z-page.h/2,maxZ=page.z+page.h/2;
  let x=Math.max(minX,Math.min(maxX,point.x)),z=Math.max(minZ,Math.min(maxZ,point.z));
  let dx=point.x-x,dz=point.z-z;
  if(Math.hypot(dx,dz)<.001){
    const edges=[{distance:point.x-minX,x:minX,z:point.z,dx:-1,dz:0},{distance:maxX-point.x,x:maxX,z:point.z,dx:1,dz:0},{distance:point.z-minZ,x:point.x,z:minZ,dx:0,dz:-1},{distance:maxZ-point.z,x:point.x,z:maxZ,dx:0,dz:1}];
    const nearest=edges.sort((a,b)=>a.distance-b.distance)[0];({x,z,dx,dz}=nearest);
  }
  const length=Math.hypot(dx,dz);return{x:x+dx/length*margin,z:z+dz/length*margin};
}
