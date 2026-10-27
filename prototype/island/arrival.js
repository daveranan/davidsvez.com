export function createArrival(){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced)return{progress:()=>1,skip(){},dispose(){}};
  const canvas=document.createElement('canvas');canvas.className='arrival-clouds';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
  const ctx=canvas.getContext('2d');let start=null,done=false;
  const cloud=document.createElement('canvas');cloud.width=768;cloud.height=430;
  const paint=cloud.getContext('2d');paint.fillStyle='#fff';paint.shadowColor='#dce8ec';paint.shadowBlur=7;paint.shadowOffsetY=4;
  paint.beginPath();for(const[x,y,r]of [[.17,.64,.15],[.34,.44,.22],[.55,.37,.23],[.76,.52,.19],[.53,.65,.28],[.30,.67,.21],[.78,.70,.14]]){paint.moveTo((x+r)*768,y*430);paint.ellipse(x*768,y*430,r*768,r*430,0,0,Math.PI*2);}paint.fill();
  const puffs=[
    {x:.18,y:.12,dx:-1,dy:-.5,s:1.15},{x:.65,y:.05,dx:.6,dy:-1,s:1.2},
    {x:.95,y:.35,dx:1,dy:-.25,s:1.15},{x:.85,y:.80,dx:1,dy:.6,s:1.15},
    {x:.25,y:.90,dx:-.6,dy:1,s:1.35},{x:-.1,y:.45,dx:-1,dy:.1,s:1.2},
    {x:.42,y:.43,dx:-1,dy:-.1,s:1.15},{x:.62,y:.61,dx:1,dy:.2,s:1.3},
  ];
  function resize(){canvas.width=innerWidth;canvas.height=innerHeight;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}resize();window.addEventListener('resize',resize);
  function finish(){if(done)return;done=true;canvas.remove();window.removeEventListener('resize',resize);document.removeEventListener('pointerdown',finish,true);document.removeEventListener('keydown',finish,true);}
  document.addEventListener('pointerdown',finish,{capture:true});document.addEventListener('keydown',finish,{capture:true});
  return{progress(time){if(done)return 1;start??=time;const t=Math.min(1,(time-start)/2800),ease=t*t*(3-2*t),w=canvas.width,h=canvas.height,scale=Math.max(w,h);
    ctx.clearRect(0,0,w,h);if(t<.16){ctx.fillStyle='rgba(255,255,255,'+(1-t/.16)+')';ctx.fillRect(0,0,w,h);}
    for(const puff of puffs){const width=scale*.94*puff.s,height=width*430/768,travel=ease*scale*1.45,x=puff.x*w+puff.dx*travel,y=puff.y*h+puff.dy*travel;ctx.drawImage(cloud,x-width/2,y-height/2,width,height);}
    if(t===1)finish();return ease;
  },skip:finish,dispose:finish};
}
