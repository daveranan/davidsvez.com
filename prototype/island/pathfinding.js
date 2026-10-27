// Bounded 2-D A* with inflated paper footprints and line-of-sight smoothing.
// It plans around pages; only an explicit page click selects one to open.
export function createPathfinder({getPages,radius=25.5,cell=.45,getHeight=()=>0,canJump=()=>false}){
  const extent=Math.ceil(radius/cell)+2,size=extent*2+1,total=size*size;
  const point=(x,z)=>({x:(x-extent)*cell,z:(z-extent)*cell});
  const grid=p=>({x:Math.max(0,Math.min(size-1,Math.round(p.x/cell)+extent)),z:Math.max(0,Math.min(size-1,Math.round(p.z/cell)+extent))});
  function blocked(p,pages){
    if(Math.hypot(p.x,p.z)>radius)return true;
    if(!canJump()&&getHeight(p.x,p.z)>.28)return true;
    return pages.some(page=>Math.abs(p.x-page.x)<page.w/2+.36&&Math.abs(p.z-page.z)<page.h/2+.36);
  }
  function clear(a,b,pages){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.18));for(let i=1;i<=n;i++){const t=i/n;if(blocked({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},pages))return false;}return true;}
  function freeNear(node,pages){if(!blocked(point(node.x,node.z),pages))return node;for(let r=1;r<16;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.abs(dx)!==r&&Math.abs(dz)!==r)continue;const x=node.x+dx,z=node.z+dz;if(x>=0&&z>=0&&x<size&&z<size&&!blocked(point(x,z),pages))return{x,z};}return null;}
  function route(start,end){
    const pages=getPages();if(clear(start,end,pages))return[{x:end.x,z:end.z}];
    const from=freeNear(grid(start),pages),to=freeNear(grid(end),pages);if(!from||!to)return[];
    const fromId=from.z*size+from.x,toId=to.z*size+to.x;
    const parents=new Int32Array(total);parents.fill(-1);const costs=new Float64Array(total);costs.fill(Infinity);const closed=new Uint8Array(total),heap=[];
    const heuristic=(x,z)=>{const dx=Math.abs(x-to.x),dz=Math.abs(z-to.z);return 10*Math.max(dx,dz)+4*Math.min(dx,dz);};
    function push(item){let i=heap.length;heap.push(item);while(i>0){const p=(i-1)>>1;if(heap[p].f<=item.f)break;heap[i]=heap[p];i=p;}heap[i]=item;}
    function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let child=i*2+1;if(child>=heap.length)break;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=last.f)break;heap[i]=heap[child];i=child;}heap[i]=last;}return top;}
    costs[fromId]=0;push({id:fromId,f:heuristic(from.x,from.z)});
    const directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    while(heap.length){const current=pop(),id=current.id;if(closed[id])continue;if(id===toId)break;closed[id]=1;const x=id%size,z=Math.floor(id/size);
      for(const[dx,dz]of directions){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=size||nz>=size)continue;const next=nz*size+nx;if(closed[next]||blocked(point(nx,nz),pages))continue;
        if(dx&&dz&&(blocked(point(x+dx,z),pages)||blocked(point(x,z+dz),pages)))continue;
        const g=costs[id]+(dx&&dz?14:10);if(g>=costs[next])continue;costs[next]=g;parents[next]=id;push({id:next,f:g+heuristic(nx,nz)});
      }
    }
    if(fromId!==toId&&parents[toId]===-1)return[];
    const raw=[];for(let id=toId;id!==-1;id=parents[id]){raw.push(point(id%size,Math.floor(id/size)));if(id===fromId)break;}raw.reverse();
    if(!blocked(end,pages))raw.push({x:end.x,z:end.z});
    const smooth=[];let anchor=start,index=0;
    while(index<raw.length){let far=index;while(far+1<raw.length&&clear(anchor,raw[far+1],pages))far++;smooth.push(raw[far]);anchor=raw[far];index=far+1;}
    return smooth;
  }
  return {route,isBlocked:p=>blocked(p,getPages())};
}
