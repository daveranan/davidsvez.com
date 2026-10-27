const asset=name=>new URL('./assets/environment/'+name,import.meta.url).href;
export function createAmbientAudio(){
  const tracks=Object.fromEntries(['menu','birds','fire','water'].map(name=>{const audio=new Audio();audio.loop=true;audio.preload='none';audio.src=asset(name+'.mp3');audio.volume=name==='menu'?.16:name==='birds'?.05:0;return[name,audio];}));
  let preference=null;try{preference=localStorage.getItem('portfolio-audio');}catch{}
  let enabled=preference!=='muted',unlocked=false,world=false,disposed=false,context=null,master=null,sfxPlayed=0,lastStep=-1,lastVoice=-1;
  const buffers=new Map(),recent=new Map(),active=new Set();let listener={x:0,y:0,z:3};
  const levels={step:.16,jump:.18,land:.16,glide:.13,kick:.24,bounce:.11,goal:.22,dig:.16,cast:.14,bite:.14,reel:.15,firetoggle:.16,interaction:.09,treasure:.18,purchase:.14,tree:.13,page:.09,voice:.085};
  const soundCounts={},lastSounds={};
  function differentIndex(count,previous){const value=Math.floor(Math.random()*(count-1));return value>=previous?value+1:value;}
  const button=document.createElement('button');button.className='audio-toggle';button.type='button';document.querySelector('.masthead').append(button);
  function sync(){document.documentElement.dataset.audioEnabled=String(enabled&&unlocked);button.textContent=enabled?'♪':'♩';button.setAttribute('aria-label',enabled?'Mute site audio':'Enable site audio');button.setAttribute('aria-pressed',String(enabled));if(master)master.gain.value=enabled?1:0;document.dispatchEvent(new CustomEvent('portfolio-audio',{detail:{enabled:enabled&&unlocked}}));}
  function prime(){if(!context){const AudioContext=window.AudioContext||window.webkitAudioContext;if(AudioContext){context=new AudioContext();master=context.createGain();master.gain.value=enabled?1:0;master.connect(context.destination);}}if(context?.state==='suspended')context.resume().catch(()=>{});}
  async function playBeds(){if(!unlocked||!enabled||document.hidden||disposed)return;prime();await Promise.all(Object.values(tracks).map(audio=>audio.play().catch(()=>{})));}
  function pauseBeds(){Object.values(tracks).forEach(audio=>audio.pause());}
  async function effect(name,position,options={}){
    if(!enabled||!unlocked||document.hidden||disposed)return;
    if(name==='footstep'||name==='step1'||name==='step2')name='step';
    if(!(name in levels))name='interaction';const now=performance.now(),cooldown=name==='step'?105:name==='voice'?48:name==='bounce'?130:70;if(now-(recent.get(name)||-Infinity)<cooldown)return;recent.set(name,now);
    prime();if(!context)return;
    let url=asset('sfx/'+name+'.mp3'),pitch=1;
    if(name==='step'){lastStep=differentIndex(6,lastStep);url=asset('sfx/footsteps/KarlFootsteps_'+String(lastStep+1).padStart(3,'0')+'.ogg');pitch=.93+Math.random()*.14;}
    else if(name==='kick'){url=asset('sfx/football-kick.ogg');pitch=.88+Math.random()*.26;}
    else if(name==='goal'){url=asset('sfx/goal-partyblower.ogg');pitch=.94+Math.random()*.12;}
    else if(name==='voice'){lastVoice=differentIndex(4,lastVoice);url=new URL('./assets/dialogue/voice-'+(lastVoice+1)+'.wav',import.meta.url).href;pitch=(options.speaker==='you'?1.32:1.03)+Math.random()*.22-.11;}
    else if(name==='bounce')pitch=.73+Math.random()*.1;
    if(!buffers.has(url))buffers.set(url,fetch(url).then(response=>{if(!response.ok)throw new Error(name+' sound unavailable');return response.arrayBuffer();}).then(data=>context.decodeAudioData(data)));
    try{const buffer=await buffers.get(url);if(!enabled||disposed||document.hidden||name==='voice'&&performance.now()-now>200)return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
      const distance=position?Math.hypot(position.x-listener.x,position.z-listener.z):0;gain.gain.value=levels[name]/(1+distance*distance/150);source.playbackRate.value=pitch;source.connect(gain);gain.connect(master);source.onended=()=>{active.delete(source);source.disconnect();gain.disconnect();};active.add(source);source.start();sfxPlayed++;soundCounts[name]=(soundCounts[name]||0)+1;lastSounds[name]={url,pitch};
    }catch(error){console.warn(error.message);}
  }
  function unlock(event){if(event?.type==='keydown'&&!['Enter','Space'].includes(event.code))return;if(event?.target?.closest?.('.audio-toggle'))return;if(unlocked)return;unlocked=true;prime();sync();playBeds();}
  function toggle(){if(!unlocked){unlocked=true;enabled=true;prime();playBeds();sync();return;}enabled=!enabled;try{localStorage.setItem('portfolio-audio',enabled?'enabled':'muted');}catch{}if(enabled)playBeds();else pauseBeds();sync();}
  function voice(event){effect('voice',null,{speaker:event.detail?.speaker});}document.addEventListener('portfolio-voice',voice);
  button.addEventListener('click',toggle);document.addEventListener('pointerdown',unlock,{capture:true});document.addEventListener('keydown',unlock,{capture:true});
  function visibility(){if(document.hidden){pauseBeds();context?.suspend().catch(()=>{});}else if(enabled){prime();playBeds();}}document.addEventListener('visibilitychange',visibility);sync();
  function level(name,target,dt){tracks[name].volume+=(target-tracks[name].volume)*(1-Math.exp(-3*dt));}
  return{play:effect,setWorldActive(value){world=value;playBeds();},getState:()=>({enabled,unlocked,world,playing:!tracks.menu.paused,sfxPlayed,counts:{...soundCounts},lastSounds:{...lastSounds}}),update(dt,{character,fireLit=true}){listener={x:character.x,y:character.y||0,z:character.z};if(disposed||!enabled||!unlocked)return;level('menu',.16,dt);level('birds',.075,dt);level('fire',fireLit?.24/(1+Math.hypot(character.x+2,character.z+10)**2/14):0,dt);level('water',.16/(1+Math.hypot(character.x-13,character.z-8.8)**2/18),dt);},destroy(){disposed=true;pauseBeds();active.forEach(source=>{try{source.stop();}catch{}});context?.close().catch(()=>{});button.remove();document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('portfolio-voice',voice);}};
}
