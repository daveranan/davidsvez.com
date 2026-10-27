export function installNavigationEffects(){
  const header=document.querySelector('.masthead'),dialog=document.querySelector('#page-dialog');
  const motion=matchMedia('(min-width:701px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
  function measure(){document.documentElement.style.setProperty('--world-nav-bottom',Math.ceil(header.getBoundingClientRect().bottom)+'px');}
  new ResizeObserver(measure).observe(header);window.addEventListener('resize',measure);measure();
  const toolbar=dialog.querySelector('.dialog-toolbar'),content=dialog.querySelector('#page-content');
  const compactReading=matchMedia('(max-width:700px), (pointer:coarse) and (max-width:1190px)');
  let lastScroll=0,scrollDirection=0,scrollTravel=0;
  function measureToolbar(){if(toolbar.offsetHeight)dialog.style.setProperty('--page-toolbar-height',toolbar.offsetHeight+'px');}
  function showNavigation(){delete dialog.dataset.mobileNavHidden;scrollDirection=0;scrollTravel=0;lastScroll=content.scrollTop;}
  new ResizeObserver(measureToolbar).observe(toolbar);measureToolbar();
  content.addEventListener('scroll',()=>{
    const current=Math.max(0,Math.min(content.scrollTop,content.scrollHeight-content.clientHeight)),delta=current-lastScroll;lastScroll=current;
    if(!compactReading.matches||!dialog.open)return;
    if(current<20){showNavigation();return;}
    if(Math.abs(delta)<.5)return;
    const direction=Math.sign(delta);if(direction!==scrollDirection){scrollDirection=direction;scrollTravel=0;}scrollTravel+=Math.abs(delta);
    if(direction>0&&current>80&&scrollTravel>18)dialog.dataset.mobileNavHidden='true';
    else if(direction<0&&scrollTravel>12)showNavigation();
  },{passive:true});
  toolbar.addEventListener('focusin',showNavigation);
  document.addEventListener('keydown',event=>{if(event.key==='Tab'&&dialog.open)showNavigation();});
  new MutationObserver(()=>{showNavigation();measureToolbar();}).observe(dialog,{attributes:true,attributeFilter:['open']});
  new MutationObserver(()=>{if(content.getAttribute('aria-busy')==='true')showNavigation();}).observe(content,{attributes:true,attributeFilter:['aria-busy']});
  compactReading.addEventListener('change',()=>{showNavigation();measureToolbar();});
  document.querySelectorAll('.navigation a').forEach(link=>{
    link.addEventListener('pointermove',event=>{if(!motion.matches||event.pointerType!=='mouse')return;const r=link.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(event.clientY-r.top)/r.height));link.style.setProperty('--shine-x',x*100+'%');link.style.setProperty('--shine-y',y*100+'%');});
  });
  const layer=document.createElement('div');layer.className='site-cursor';layer.setAttribute('aria-hidden','true');
  const ring=document.createElement('i'),dot=document.createElement('i');ring.className='cursor-ring';dot.className='cursor-dot';layer.append(ring,dot);
  let x=0,y=0,fx=0,fy=0,frame=0,visible=false,target=null,lastTime=0;
  function hide(){visible=false;layer.dataset.visible='false';delete document.documentElement.dataset.enhancedCursor;cancelAnimationFrame(frame);frame=0;}
  function moveCursor(time){
    frame=0;if(!visible||!motion.matches)return;
    const host=dialog.open?dialog:document.body;if(layer.parentNode!==host)host.append(layer);
    const dt=Math.min((time-lastTime)/1000,.05)||1/60;lastTime=time;const alpha=1-Math.exp(-24*dt);fx+=(x-fx)*alpha;fy+=(y-fy)*alpha;
    dot.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;ring.style.transform=`translate3d(${fx}px,${fy}px,0) translate(-50%,-50%)`;
    layer.dataset.interactive=String(!!target?.closest?.('a,button,[role=button]')||target?.tagName==='CANVAS'&&target.style.cursor==='pointer');
    const transitioning=dialog.open&&dialog.getAnimations().length>0;layer.dataset.visible=String(!transitioning);
    if(Math.abs(x-fx)+Math.abs(y-fy)>.1||transitioning)frame=requestAnimationFrame(moveCursor);
  }
  document.addEventListener('pointermove',event=>{
    if(!motion.matches||event.pointerType!=='mouse'||event.target.closest?.('input,textarea,select,[contenteditable=true]')){hide();return;}
    if(dialog.open){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){hide();return;}}
    x=event.clientX;y=event.clientY;target=event.target;
    if(!visible){fx=x;fy=y;visible=true;document.documentElement.dataset.enhancedCursor='true';}
    if(!frame)frame=requestAnimationFrame(moveCursor);
  },{passive:true});
  document.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'){hide();return;}if(visible)ring.animate([{boxShadow:'0 0 0 0 #f5f1dd90'},{boxShadow:'0 0 0 12px #f5f1dd00'}],{duration:320,easing:'ease-out'});});
  document.addEventListener('keydown',hide);document.addEventListener('pointerleave',hide);window.addEventListener('blur',hide);document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});
  document.addEventListener('pointerout',event=>{if(!event.relatedTarget)hide();});
  document.addEventListener('scroll',hide,{capture:true,passive:true});
  new MutationObserver(hide).observe(dialog,{attributes:true,attributeFilter:['open']});motion.addEventListener('change',hide);
}
