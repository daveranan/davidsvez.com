/** Tap selects once; holding or dragging steers until release. */
export function createPointControls(canvas,{isEnabled,onPress,onTap,onHoldStart,onHoldMove,onHoldEnd}){
  let press=null;
  canvas.style.touchAction='none';canvas.style.webkitTouchCallout='none';
  function beginHold(){if(!press||press.holding)return;press.holding=true;onHoldStart?.();}
  function finish(event,cancelled=false){
    if(!press||event&&event.pointerId!==press.id)return;
    const ended=press;press=null;
    try{if(canvas.hasPointerCapture(ended.id))canvas.releasePointerCapture(ended.id);}catch{}
    const held=ended.holding||performance.now()-ended.started>=180;
    if(held){onHoldEnd?.();return;}
    if(!cancelled&&isEnabled()&&document.elementFromPoint(event.clientX,event.clientY)===canvas)onTap?.(event);
  }
  function down(event){
    if(event.button!==0||event.isPrimary===false||press||!isEnabled())return;
    press={id:event.pointerId,type:event.pointerType,startX:event.clientX,startY:event.clientY,clientX:event.clientX,clientY:event.clientY,started:performance.now(),holding:false};
    onPress?.();try{canvas.setPointerCapture(event.pointerId);}catch{}event.preventDefault();
  }
  function move(event){
    if(!press||event.pointerId!==press.id)return;
    if(event.pointerType==='mouse'&&!(event.buttons&1)){finish(event,true);return;}
    press.clientX=event.clientX;press.clientY=event.clientY;
    if(Math.hypot(press.clientX-press.startX,press.clientY-press.startY)>10)beginHold();
  }
  function up(event){if(event.button===0)finish(event);}
  function cancel(event){finish(event?.pointerId!==undefined?event:null,true);}
  function visibility(){if(document.hidden)cancel();}
  function contextMenu(event){event.preventDefault();}
  canvas.addEventListener('pointerdown',down);window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);canvas.addEventListener('contextmenu',contextMenu);window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',visibility);
  return{
    update(){if(!press)return;if(!isEnabled()){cancel();return;}if(!press.holding&&performance.now()-press.started>=180)beginHold();if(press?.holding)onHoldMove?.(press);},
    cancel,getState:()=>({holding:!!press?.holding,pointerType:press?.type||null}),
    destroy(){cancel();canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);canvas.removeEventListener('lostpointercapture',cancel);canvas.removeEventListener('contextmenu',contextMenu);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',visibility);}
  };
}
