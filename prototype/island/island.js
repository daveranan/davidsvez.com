import {createAmbientAudio} from './ambient-audio.js';
import { destinations, element, loadPortfolio } from './portfolio.js';
import { updateDocumentSeo } from './seo.js';
import { installNavigationEffects } from './navigation-effects.js';
import { createSiteLoader } from './loading.js';

const $=selector=>document.querySelector(selector);
const dialog=$('#page-dialog'),content=$('#page-content');
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
const audio=createAmbientAudio();
const loading=createSiteLoader();
loading.stage(1,'Loading portfolio');
installNavigationEffects();
const BASE=new URL('.',import.meta.url).pathname;
const slugs={product:'product-design',games:'technical-design',resume:'resume',archive:'case-studies',contact:'contact',blog:'blog'};
let landscape=null,worldPromise=null,portfolio=null,openId=null,currentToken='',returnFocus=null,closing=false,routeVersion=0;
let currentAnimation=null,openingFromScene=false,dialogueSystem=null,dialoguePromise=null;
const hrefFor=token=>/^(project|blog)\//.test(token)?BASE+token+'/':token?BASE+slugs[token]+'/':BASE;
function tokenFromLocation(){
  const path=decodeURIComponent(location.pathname.slice(BASE.length)).replace(/^\/+|\/+$/g,'');
  if(/^(project|blog)\//.test(path))return path;
  return Object.keys(slugs).find(key=>slugs[key]===path)||'';
}
function sectionFor(id,project){
  return project?.sectionId||destinations.find(d=>d.projects.includes(id))?.id||(project?.category==='GAME'?'games':'archive');
}
function updateNavigation(id){document.querySelectorAll('[data-page]').forEach(link=>{
  if(link.dataset.page===id){
    link.setAttribute('aria-current','page');
    const nav=link.closest('.navigation');
    if(nav&&nav.scrollWidth>nav.clientWidth){const start=link.offsetLeft-nav.offsetLeft,end=start+link.offsetWidth;if(start<nav.scrollLeft+12)nav.scrollLeft=Math.max(0,start-12);else if(end>nav.scrollLeft+nav.clientWidth-12)nav.scrollLeft=end-nav.clientWidth+12;}
  }else link.removeAttribute('aria-current');
});}
function animatePage(opening,fromScene=false){
  currentAnimation?.cancel();if(reducedQuery.matches)return Promise.resolve();
  const from=fromScene?landscape?.pageRect(openId):null,r=dialog.getBoundingClientRect();
  const visible=from&&from.x<innerWidth&&from.y<innerHeight&&from.x+from.width>0&&from.y+from.height>0;
  const transform=visible?`translate(${from.x+from.width/2-r.x-r.width/2}px,${from.y+from.height/2-r.y-r.height/2}px) perspective(1600px) rotateX(35deg) rotateZ(17deg) scale(${Math.min(.9,from.width/r.width)},${Math.min(.9,from.height/r.height)})`:'translateY(16px) scale(.985)';
  currentAnimation=dialog.animate(opening?[{transform,opacity:visible?.8:0},{transform:'none',opacity:1}]:[{transform:'none',opacity:1},{transform:visible?transform:'translateY(10px)',opacity:0}],{duration:opening?visible?620:240:220,easing:'cubic-bezier(.2,.8,.2,1)'});
  return currentAnimation.finished.catch(()=>{});
}
async function ensureDialogue(){
  if(dialogueSystem)return dialogueSystem;
  if(!dialoguePromise)dialoguePromise=import('./dialogue.js').then(({createDialogueSystem})=>dialogueSystem=createDialogueSystem({onInteract:()=>talk('about'),getActions:()=>landscape?.getActions()||[],onAction:async id=>{if(id==='visit-shop'){landscape?.visitGuide();return{close:true};}await ensureWorld();return landscape?.performAction(id);},getAnchor:speaker=>landscape?.getSpeechAnchor(speaker),onNavigate:token=>navigate(token),onGuideSection:id=>content.querySelector('[data-block-id='+CSS.escape(id)+']')?.scrollIntoView({behavior:reducedQuery.matches?'instant':'smooth'})}));
  return dialoguePromise;
}
async function talk(topic='about'){if(dialog.open)return;const system=await ensureDialogue();if(dialog.open)return;landscape?.converse(true);await system.open(topic);}
async function greet(text='hey. come here for a second.',speaker='guide'){if(dialog.open)return;const system=await ensureDialogue();if(!dialog.open)system.bark(text,speaker);}
async function ensureWorld(){
  if(worldPromise)return worldPromise;
  worldPromise=(async()=>{
    loading.stage(2,'Loading the island');await portfolio.prepareWorld();const {createLandscape}=await import('./scene.js');
    landscape=await createLandscape($('#world'),portfolio,{audio,onLoadStage:(n,text)=>loading.stage(n,text),onReady:()=>loading.finish(),onBark:greet,onFrame:()=>dialogueSystem?.reposition(),reduced:reducedQuery.matches,onSelect:id=>navigate(id,{fromScene:true}),onDialogue:talk,onAdvanceDialogue:()=>dialogueSystem?.advance(),onDismissDialogue:()=>dialogueSystem?.close(),onNavigate:token=>navigate(token)});
    if(dialog.open)landscape.pause(true);else audio.setWorldActive(true);return landscape;
  })().catch(error=>{document.querySelectorAll('.arrival-clouds').forEach(node=>node.remove());loading.finish();console.warn('3D scene unavailable:',error.message);const notice=element('p','error-message','The 3D scene is unavailable. Use the navigation to view the portfolio.');$('#world').append(notice);});
  return worldPromise;
}
async function openRoute(token,{fromScene=false}={}){
  const version=++routeVersion;currentToken=token;closing=false;
  if(!token){await closePage({updateUrl:false});await ensureWorld();return;}
  const wasOpen=dialog.open;if(!wasOpen)returnFocus=document.activeElement;
  const projectId=token.startsWith('project/')?token.slice(8):null;
  const postId=token.startsWith('blog/')?token.slice(5):null;
  openId=postId?'blog':projectId?sectionFor(projectId):token;openingFromScene=fromScene;
  landscape?.pause(true);dialog.dataset.page=openId;
  if(!wasOpen){content.replaceChildren(element('h1','','Loading…'));content.querySelector('h1').id='page-title';dialog.showModal();$('#close').focus({preventScroll:true});animatePage(true,fromScene);}
  content.setAttribute('aria-busy','true');
  try{
    if(postId)await portfolio.showPost(postId);else if(projectId)await portfolio.showProject(projectId);else await portfolio.showDestination(token);
    if(version!==routeVersion)return;
    if(wasOpen&&!reducedQuery.matches)content.animate([{opacity:.35},{opacity:1}],{duration:180});
    $('#announcement').textContent=(projectId||postId?$('#page-title').textContent:destinations.find(d=>d.id===token)?.label)+' opened';
  }catch(error){
    if(version!==routeVersion)return;content.replaceChildren(element('h1','','This page could not load.'));content.querySelector('h1').id='page-title';const retry=element('button','text-link','Try again');retry.addEventListener('click',()=>openRoute(token));content.append(retry);console.warn(error.message);
  }finally{if(version===routeVersion)content.removeAttribute('aria-busy');}
}
function navigate(token,{fromScene=false,replace=false}={}){
  dialogueSystem?.close();
  landscape?.converse(false);
  const parent=currentToken;if(token)audio.play('page');
  if(location.pathname!==hrefFor(token)||location.hash)history[replace?'replaceState':'pushState']({token,parent},'',hrefFor(token));
  return openRoute(token,{fromScene});
}
async function closePage({updateUrl=true}={}){
  if(closing||!dialog.open)return;closing=true;await animatePage(false,openingFromScene);if(!closing)return;
  portfolio.clear();dialog.close();closing=false;currentToken='';
  if(updateUrl)history.pushState({token:''},'',BASE);
  await ensureWorld();
}
dialog.addEventListener('close',()=>{landscape?.pause(false);updateNavigation(null);updateDocumentSeo({path:'/',kind:'home'});if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
document.addEventListener('close',event=>{if(event.target.matches?.('.npc-conversation')&&!dialog.open)landscape?.converse(false);},true);
dialog.addEventListener('cancel',event=>{event.preventDefault();closePage();});
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closePage();});
$('#close').addEventListener('click',()=>closePage());
$('#page-location').addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();closePage();});
document.querySelectorAll('[data-page]').forEach(link=>{link.href=hrefFor(link.dataset.page);link.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(link.dataset.page);});});
document.querySelectorAll('.identity,.brand-home').forEach(link=>{link.href=BASE;link.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate('');});});
reducedQuery.addEventListener('change',event=>landscape?.setReduced(event.matches));
window.addEventListener('popstate',()=>openRoute(tokenFromLocation()));
async function init(){
  portfolio=await loadPortfolio(content,(projectId,title,project)=>{
    if(projectId)openId=sectionFor(projectId,project);
    dialog.dataset.page=openId;updateNavigation(openId);
    updateDocumentSeo({path:location.pathname,title,description:project?.description,kind:project?.seoKind||'page',datePublished:project?.date,items:project?.items||[]});
  },{onNavigate:token=>navigate(token),getActions:()=>landscape?.getActions()||[],onAction:async id=>{await ensureWorld();return landscape?.performAction(id);}});
  window.fieldTrip={getState:()=>({...landscape?.getState(),dialogOpen:dialog.open,openPage:openId,route:currentToken,reduced:reducedQuery.matches}),destinations:()=>landscape?.destinations()||[],groundPoint:(x,z)=>landscape?.groundPoint(x,z),activities:()=>landscape?.activities?.()||[],trees:()=>landscape?.trees?.()||[],groundHeight:(x,z)=>landscape?.groundHeight(x,z)||0,terrainPoint:(x,z)=>landscape?.terrainPoint(x,z)};
  const legacy=location.hash.slice(1),query=new URLSearchParams(location.search),legacyProject=query.get('project'),legacyPost=query.get('post'),legacyPage=query.get('page');
  const queryToken=legacyProject&&/^[a-z0-9-]+$/.test(legacyProject)?'project/'+legacyProject:legacyPost&&/^[a-z0-9-]+$/.test(legacyPost)?'blog/'+legacyPost:slugs[legacyPage]?legacyPage:'';
  const initial=tokenFromLocation()||queryToken||(destinations.some(d=>d.id===legacy)?legacy:'');
  if((legacy||queryToken)&&initial)history.replaceState({token:initial},'',hrefFor(initial));
  if(initial){loading.stage(2,'Loading page');await openRoute(initial);await loading.finish();}else await ensureWorld();
}
init().catch(error=>{loading.finish();console.error(error);const notice=element('p','error-message','Portfolio content could not load. ');const link=element('a','','Open the original portfolio.');link.href='/';notice.append(link);$('#world').append(notice);});
