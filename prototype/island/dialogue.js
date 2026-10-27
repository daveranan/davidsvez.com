import {worldConversation,createDialogueOpeningDeck} from './dialogue-story.js';
const asset=name=>new URL('./assets/dialogue/'+name,import.meta.url).href;
let stylesheetReady,muted=false,nextId=0,keyboardInput=false;
document.addEventListener('pointerdown',()=>{keyboardInput=false;},true);document.addEventListener('keydown',event=>{if(event.key==='Tab')keyboardInput=true;},true);
function ensureStyles(){if(!stylesheetReady)stylesheetReady=new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./dialogue.css',import.meta.url).href;link.onload=link.onerror=resolve;document.head.append(link);});return stylesheetReady;}
function node(tag,className='',text=''){const el=document.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;}
function speakBlip(speaker='guide'){document.dispatchEvent(new CustomEvent('portfolio-letter',{detail:{speaker}}));if(muted||document.hidden||document.documentElement.dataset.audioEnabled==='false')return;document.dispatchEvent(new CustomEvent('portfolio-voice',{detail:{speaker}}));}
function typeText(target,text,speaker,onComplete){
  let frame=0,start,lastVoice=0,nextVoice=2,cancelled=false;const duration=Math.min(700,text.length*45);
  function tick(time){if(cancelled)return;start??=time;const t=Math.min(1,(time-start)/Math.max(1,duration)),count=Math.ceil(t*text.length);target.textContent=text.slice(0,count);
    if(count>=nextVoice){if(/[\p{L}\p{N}]/u.test(text.slice(lastVoice,count)))speakBlip(speaker);lastVoice=count;nextVoice=count+2+Math.floor(Math.random()*2);}
    if(t<1)frame=requestAnimationFrame(tick);else onComplete?.();
  }
  frame=requestAnimationFrame(tick);return{cancel(){cancelled=true;cancelAnimationFrame(frame);}};
}
const caseConversation = {
  about: {
    lines:[['guide','this is lightkeeper. want to look around?']],
    title: 'Lightkeeper guide',
    text: 'David’s credited role: game director, game designer, and producer. Which part of the project would you like to examine?',
    choices: [['David’s contribution', { next: 'role' }], ['Traversal and characters', { next: 'play' }], ['World-building tools', { next: 'tools' }], ['How the project developed', { next: 'development' }], ['Show the game', { section: 'lk-hero' }]],
  },
  role: {
    lines:[['guide','dave’s role: game director, game designer, producer.'],['guide','he worked with the team from the jam to the playable slice.']],
    title: 'David’s contribution',
    text: 'He worked with the team from the original game-jam concept through funded development and the playable slice. This case study focuses on traversal, discovery, character interaction, and progression.',
    choices: [['Read the role overview', { section: 'lk-role-compact' }], ['Other questions', { next: 'about', back: true }]],
  },
  play: {
    lines:[['guide','the traversal clip is actual playable-slice footage.'],['guide','the character-interaction clip is right beside it.']],
    title: 'Traversal and characters',
    text: 'The current slice combines climbing and movement with in-world encounters across the archipelago. There are separate demonstrations for traversal and character interaction.',
    choices: [['Show traversal', { section: 'lk-climbing' }], ['Show character interactions', { section: 'lk-characters' }], ['Learn jump + glide · 4 coins', { action: 'learn-jump' }], ['Other questions', { next: 'about', back: true }]],
  },
  tools: {
    lines:[['guide','the world needed tools too. terrain, progression, layout.'],['guide','i can show you the authoring workflows.']],
    title: 'World-building tools',
    text: 'The project needed terrain, progression, and layout tools so a small team could iterate on world scale, pacing, and content. The case study shows those authoring workflows beside the game they supported.',
    choices: [['Show terrain authoring', { section: 'lk-terrain' }], ['Show progression authoring', { section: 'lk-progression' }], ['Read the tools overview', { section: 'lk-tools-compact' }], ['Other questions', { next: 'about', back: true }]],
  },
  development: {
    lines:[['guide','it began as fell out, a game jam.'],['guide','concept funding in 2024. prototype funding later that year.'],['guide','the playable slice also meant cutting completed work.']],
    title: 'From game jam to vertical slice',
    text: 'Lightkeeper began as Fell Out. FFF Bayern concept funding in 2024 supported a larger pitch, and prototype funding followed later that year. Reaching the playable slice also meant cutting completed work as the direction changed.',
    choices: [['Read about the development', { section: 'lk-outcome-compact' }], ['Other questions', { next: 'about', back: true }]],
  },
};


function makeConversationView({conversations,onNavigate,onGuideSection,onAction,getActions,onClose,onLayout}){
  const id='npc-dialogue-'+(++nextId),root=node('div','npc-dialogue-view');
  const choices=node('div','npc-choices');choices.hidden=true;choices.setAttribute('aria-label','Dialogue choices');
  const bubble=node('div','npc-bubble'),title=node('h2','sr-only'),name=node('span','npc-name'),line=node('button','npc-line'),reserve=node('span','npc-line-reserve'),shown=node('span','npc-line-shown');
  title.id=id+'-title';line.type='button';line.setAttribute('aria-label','Continue conversation');reserve.setAttribute('aria-hidden','true');shown.setAttribute('aria-hidden','true');line.append(reserve,shown);
  const tools=node('div','npc-tools'),sound=node('button','npc-sound','♪'),close=node('button','npc-close','×');sound.type=close.type='button';close.setAttribute('aria-label','Close conversation');tools.append(sound,close);
  const advance=node('span','npc-advance','▾');advance.setAttribute('aria-hidden','true');name.setAttribute('aria-hidden','true');bubble.append(title,name,line,advance);root.append(choices,bubble,tools);const measureContext=document.createElement('canvas').getContext('2d');let widthKey='',measuredWidth=0;
  let audio=null,typing=null,topic='',lines=[],index=0,item=null,revealed=false,destroyed=false,choicesVisible=false,firstPresentation=true,selectedChoice=null;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function soundUI(){sound.setAttribute('aria-label',muted?'Unmute dialogue':'Mute dialogue');sound.setAttribute('aria-pressed',String(!muted));sound.textContent=muted?'♩':'♪';}
  function blip(){if(!destroyed)speakBlip(lines[index]?.speaker);}
  function hush(){typing?.cancel();audio?.pause();}
  function globalAudio(event){muted=!event.detail.enabled;soundUI();}
  document.addEventListener('portfolio-audio',globalAudio);document.addEventListener('visibilitychange',hush);
  sound.addEventListener('click',()=>{muted=!muted;soundUI();if(muted)hush();else blip();});close.addEventListener('click',onClose);
  function reveal(){typing?.cancel();shown.textContent=lines[index]?.text||'';revealed=true;advance.hidden=false;onLayout?.();}
  function renderLine(){
    const previousHeight=bubble.getBoundingClientRect().height,isFirst=firstPresentation;firstPresentation=false;
    choices.hidden=true;choicesVisible=false;const entry=lines[index];if(!entry)return;
    title.textContent=item.title||'Conversation';reserve.textContent=entry.text;shown.textContent='';revealed=false;advance.hidden=true;
    root.dataset.speaker=entry.speaker;line.setAttribute('aria-label',entry.text+' Continue.');
    name.textContent=entry.speaker==='you'?'YOU':entry.speaker==='sign'?'SIGN':'DAVE';
    typing?.cancel();
    if(reduced())reveal();else typing=typeText(shown,entry.text,entry.speaker,reveal);
    soundUI();onLayout?.();
    if(!reduced()){
      if(isFirst)bubble.animate([{transform:'scale(.88)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:200,easing:'cubic-bezier(.215,.61,.355,1)'});
      else{shown.animate([{transform:'scale(.96)',opacity:.2},{transform:'scale(1)',opacity:1}],{duration:120,easing:'cubic-bezier(.215,.61,.355,1)'});const height=bubble.getBoundingClientRect().height;if(previousHeight&&Math.abs(previousHeight-height)>1)bubble.animate([{height:previousHeight+'px'},{height:height+'px'}],{duration:180,easing:'cubic-bezier(.34,1.56,.64,1)'});}
    }
  }
  function selectChoice(button){if(!button||button.disabled)return;selectedChoice=button;choices.querySelectorAll('button').forEach(option=>option.dataset.selected=String(option===button));}
  choices.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const buttons=[...choices.querySelectorAll('button:not(:disabled)')];if(!buttons.length)return;const index=buttons.indexOf(selectedChoice),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;selectChoice(buttons[next]);buttons[next].focus({preventScroll:true});});
  function buildChoices(){
    choices.replaceChildren();let list=[...(item.choices||[])];
    if(item.shop){const actions=getActions?.()||[];list=[...actions.map(action=>[action.owned?action.label+' ✓':action.label,{action:action.id,owned:action.owned}]),...list];}
    for(const [label,action] of list){const button=node('button','npc-choice',label);button.type='button';button.disabled=!!action.owned;
      button.addEventListener('click',async()=>{
        if(action.next){show(action.next,true);return;}
        if(action.navigate){onClose();onNavigate?.(action.navigate);return;}
        if(action.section){onClose();onGuideSection?.(action.section);return;}
        if(action.action){const result=await onAction?.(action.action);if(result?.close){onClose();return;}if(result?.ok&&action.action==='learn-jump'){show('jump-learned',true);return;}showMessage(result?.text||'let’s try that in the clearing.');return;}
        if(action.close)onClose();
      });button.addEventListener('pointerenter',()=>selectChoice(button));button.addEventListener('focus',()=>selectChoice(button));choices.append(button);
    }
    if(!list.length){const button=node('button','npc-choice','see you around');button.type='button';button.onclick=onClose;choices.append(button);}
    selectChoice(choices.querySelector('button:not(:disabled)'));
  }
  function continueLine(){if(!revealed){reveal();return;}if(index<lines.length-1){index++;renderLine();return;}choices.hidden=!choices.hidden;choicesVisible=!choices.hidden;advance.hidden=choicesVisible;onLayout?.();if(choicesVisible&&!reduced())choices.animate([{transform:'scale(.88)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:200,easing:'cubic-bezier(.215,.61,.355,1)'});if(choicesVisible&&keyboardInput)selectedChoice?.focus({preventScroll:true});}
  line.addEventListener('click',continueLine);
  function show(value='about',focus=false,startAt=0,first=false){if(first)firstPresentation=true;topic=value;item=conversations[value]||worldConversation[value]||conversations.about;
    const raw=item.lines||String(item.text||'').split(/(?<=[.!?])\s+/).filter(Boolean).map(text=>['guide',text]);
    lines=raw.map(entry=>({speaker:entry[0],text:entry[1]}));index=Math.min(startAt,lines.length-1);buildChoices();renderLine();if(focus)line.focus({preventScroll:true});
  }
  function showMessage(text){item={title:'Clearing guide',choices:[['anything else?',{next:'shop-more'}],['thanks',{close:true}]]};lines=[{speaker:'guide',text}];index=0;buildChoices();renderLine();}
  return{bubble:root,choices,titleId:title.id,lineButton:line,closeButton:close,show,showMessage,hush,advance:continueLine,getSpeaker:()=>lines[index]?.speaker||'guide',getWidth:()=>{const key=(innerWidth<700)+'|'+(lines[index]?.text||'');if(key!==widthKey){widthKey=key;measureContext.font='700 '+(innerWidth<700?14:16)+'px LightkeeperDialogue';measuredWidth=Math.min(500,Math.max(140,measureContext.measureText(lines[index]?.text||'').width+36));}return measuredWidth;},destroy(){destroyed=true;hush();document.removeEventListener('visibilitychange',hush);document.removeEventListener('portfolio-audio',globalAudio);root.remove();}};
}

export function createDialogueSystem({onNavigate,onGuideSection,getAnchor,onAction,getActions,onInteract}={}){
  let root=null,view=null,priorFocus=null,destroyed=false,bark=null,barkTimer=null,barkTyping=null,presentationVersion=0,pendingOpening=null;
  const conversations={...worldConversation},openingDeck=createDialogueOpeningDeck({readState:()=>JSON.parse(sessionStorage.getItem('island.dialogue.intros.v1')||'null'),writeState:value=>sessionStorage.setItem('island.dialogue.intros.v1',JSON.stringify(value))});
  function position(){
    if(bark&&!bark.hidden){const a=getAnchor?.(bark.dataset.speaker||'guide');if(a){const width=Math.min(innerWidth-24,340);bark.style.width=width+'px';bark.style.left=Math.max(width/2+12,Math.min(innerWidth-width/2-12,a.x))+'px';bark.style.top=(a.y-18)+'px';if(a.y<60||a.y>innerHeight+40)bark.hidden=true;}}
    if(!root?.open)return;const anchor=getAnchor?.(view.getSpeaker())||{x:innerWidth/2,y:innerHeight*.55};
    const header=document.querySelector('.masthead')?.getBoundingClientRect().bottom||0;
    const width=Math.min(view.getWidth(),innerWidth-24);root.style.width=width+'px';
    const x=Math.max(width/2+12,Math.min(innerWidth-width/2-12,anchor.x));
    const available=Math.max(110,anchor.y-header-44);root.style.setProperty('--choices-height',Math.max(70,available-95)+'px');
    const height=root.getBoundingClientRect().height;
    root.style.left=(x-width/2)+'px';root.style.top=Math.min(innerHeight-height-24,Math.max(header+30,anchor.y-height-18))+'px';
    root.style.setProperty('--tail-x',Math.max(20,Math.min(width-20,anchor.x-x+width/2))+'px');
    if(!view.choices.hidden){
      const response=getAnchor?.('you')||anchor,options=view.choices,optionWidth=Math.min(310,innerWidth-24);options.style.width=optionWidth+'px';
      const h=options.offsetHeight,left=Math.max(12,Math.min(innerWidth-optionWidth-12,response.x-optionWidth/2)),speech=root.getBoundingClientRect();let top=response.y-h-18;
      if(left<speech.right+8&&left+optionWidth>speech.left-8&&top<speech.bottom+18&&top+h>speech.top-8)top=speech.bottom+26;
      options.style.left=left+'px';options.style.top=Math.max(header+12,Math.min(innerHeight-h-18,top))+'px';
    }
  }
  function close(){presentationVersion++;if(bark)bark.hidden=true;clearTimeout(barkTimer);barkTyping?.cancel();if(!root?.open)return;view.hush();root.hidden=true;root.open=false;root.dispatchEvent(new Event('close',{bubbles:true}));if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});}
  function initialize(){if(root)return;root=node('section','npc-conversation');root.hidden=true;root.open=false;root.setAttribute('role','dialog');root.setAttribute('aria-modal','false');
    view=makeConversationView({conversations,onNavigate,onGuideSection,onAction,getActions,onClose:close,onLayout:()=>requestAnimationFrame(position)});root.setAttribute('aria-labelledby',view.titleId);root.append(view.bubble);document.body.append(root);
  }
  function escape(event){if(root?.open&&(event.code==='Space'||event.key==='Enter')&&!/BUTTON|INPUT|TEXTAREA|SELECT/.test(event.target.tagName)){event.preventDefault();event.stopPropagation();view.advance();return;}if(event.key==='Escape'&&root?.open){event.preventDefault();event.stopPropagation();close();}}
  function outside(event){if(root?.open&&!root.contains(event.target))close();}
  document.addEventListener('keydown',escape,true);document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',position);
  return{
    async bark(text='hey. come here for a second.',speaker='guide'){
      if(destroyed||root?.open)return;const version=++presentationVersion;await ensureStyles();await document.fonts.load('16px LightkeeperDialogue');if(destroyed||root?.open||version!==presentationVersion)return;if(text==='hey. come here for a second.'){pendingOpening=openingDeck.next();text=pendingOpening.greeting;}barkTyping?.cancel();
      if(!bark){bark=node('section','npc-passive-bark');const bubble=node('div','npc-bubble'),name=node('span','npc-name','DAVE'),line=node('button','npc-line');line.type='button';line.setAttribute('aria-label','Talk to Dave');line.append(node('span','npc-line-reserve'),node('span','npc-line-shown'));line.addEventListener('click',()=>{bark.hidden=true;barkTyping?.cancel();onInteract?.();});bubble.append(name,line);bark.append(bubble);document.body.append(bark);}
      bark.hidden=false;bark.dataset.speaker=speaker;bark.querySelector('.npc-name').textContent=speaker==='you'?'YOU':'DAVE';const line=bark.querySelector('.npc-line');line.querySelector('.npc-line-reserve').textContent=text;const shown=line.querySelector('.npc-line-shown');shown.textContent='';position();
      if(matchMedia('(prefers-reduced-motion: reduce)').matches)shown.textContent=text;else{barkTyping=typeText(shown,text,speaker);bark.querySelector('.npc-bubble').animate([{transform:'scale(.88)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:200,easing:'cubic-bezier(.215,.61,.355,1)'});}
      clearTimeout(barkTimer);barkTimer=setTimeout(()=>{if(bark)bark.hidden=true;barkTyping?.cancel();},4200);
    },
    async open(topic='about'){if(destroyed)return;const version=++presentationVersion;await ensureStyles();await document.fonts.load('16px LightkeeperDialogue');if(destroyed||version!==presentationVersion)return;if(topic==='about'){conversations.about={...worldConversation.about,lines:(pendingOpening||openingDeck.next()).lines};pendingOpening=null;}initialize();priorFocus=document.activeElement;if(bark)bark.hidden=true;barkTyping?.cancel();clearTimeout(barkTimer);root.hidden=false;root.open=true;view.show(topic,false,0,true);position();if(keyboardInput)view.lineButton.focus({preventScroll:true});},
    close,advance(){view?.advance();},isOpen:()=>!!root?.open,reposition:position,destroy(){destroyed=true;close();view?.destroy();root?.remove();bark?.remove();clearTimeout(barkTimer);document.removeEventListener('keydown',escape,true);document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',position);}
  };
}

export function attachCaseGuide(container,projectId,{onGuideSection,onAction,getActions}={}){
  if(projectId!=='lightkeeper'||!container)return()=>{};ensureStyles();
  const root=node('aside','case-guide');root.setAttribute('aria-label','Optional Lightkeeper guide');
  const launcher=node('button','case-guide-trigger');launcher.type='button';launcher.setAttribute('aria-label','Ask about Lightkeeper');launcher.setAttribute('aria-expanded','false');
  const portrait=node('img','npc-portrait');portrait.src=asset('guide.webp');portrait.alt='';portrait.width=48;portrait.height=64;launcher.append(portrait,node('span','case-guide-label','talk'));
  const panel=node('section','case-guide-panel');panel.id='case-guide-'+(++nextId);panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');launcher.setAttribute('aria-controls',panel.id);
  let view=null;
  function close(){if(panel.hidden)return;panel.hidden=true;view?.hush();launcher.setAttribute('aria-expanded','false');launcher.focus({preventScroll:true});}
  function open(){if(!view){view=makeConversationView({conversations:caseConversation,onGuideSection,onAction,getActions,onClose:close});panel.setAttribute('aria-labelledby',view.titleId);panel.append(view.bubble);}panel.hidden=false;launcher.setAttribute('aria-expanded','true');view.show('about',false,0,true);if(keyboardInput)view.lineButton.focus({preventScroll:true});}
  launcher.addEventListener('click',()=>panel.hidden?open():close());
  function escape(event){if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopPropagation();close();}}
  const scope=container.closest('dialog')||container;scope.addEventListener('keydown',escape,true);root.append(panel,launcher);container.append(root);
  return()=>{scope.removeEventListener('keydown',escape,true);view?.destroy();root.remove();};
}
