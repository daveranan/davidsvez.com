export const destinations = [
  { id: 'product', number: '01', title: 'Product design', label: 'Product design', color: '#eef3f4', ink: '#223944', x: -7.5, z: -3.5, w: 9.2, h: 6.2, projects: ['userwise', 'flax-editor', 'earthwallet', 'yogajoint'], intro: 'Product and UX design for content authoring, developer tools, and mobile services.' },
  { id: 'games', number: '02', title: 'Technical game design', label: 'Technical design', color: '#223a32', ink: '#f3ecd6', x: 4.5, z: -5.8, w: 9.8, h: 6.6, projects: ['lightkeeper', 'kern', 'swamp-fellas', 'prototypes', 'game-jams'], intro: 'Game design and development across exploration, investigation, and multiplayer prototypes, with the tools behind them.' },
  { id: 'resume', number: '03', title: 'Résumé', label: 'Résumé', color: '#e1c39e', ink: '#3b342a', x: 6.3, z: 2.5, w: 4.8, h: 3.4, projects: [], intro: 'Selected project experience across product design, game design, development, and creative direction.' },
  { id: 'archive', number: '04', title: 'Other case studies', label: 'Other case studies', color: '#c0c6d0', ink: '#29363f', x: -6.8, z: 6.4, w: 8.2, h: 5.4, projects: ['daedalus', 'dronies', 'apps', 'visual-lab', 'marathon-tau-ceti', 'client-work'], intro: 'Other work in film, storytelling, motion, and interactive experiments.' },
  { id: 'contact', number: '05', title: 'Contact', label: 'Contact', color: '#c36b42', ink: '#fbf0d8', x: 2.1, z: 7.3, w: 4.8, h: 3.2, projects: [], intro: '' },
  { id: 'blog', number: '06', title: 'Blog', label: 'Blog', color: '#e7ebe0', ink: '#35483c', x: -4.5, z: 12.8, w: 6.4, h: 4.2, projects: [], intro: 'Essays on game development and creative production.' },
];

export const asset = path => path ? new URL(path, new URL('../', import.meta.url)).href : '';
export const pretty = (text = '') => text.replace(/\.(GAME|APP|DIR|EXPERIMENT|WEBSITE|FILM|RECOVER|PRODUCT|PROJECT|EDITOR|PRODUCTION)$/i, '').replace(/_/g, ' ').replace(/^yogajoint$/i,'YogaJoint');
export function element(tag, className = '', text = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}
function safeUrl(path) {
  try { const url = new URL(path, location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
function linkTo(path, label) {
  const a = element('a', '', label);
  a.href = safeUrl(path) || '#';
  if (new URL(a.href).origin !== location.origin) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  return a;
}

export async function loadPortfolio(container, onProjectChange, options = {}) {
  const projects = [], projectMap = new Map(), detailCache = new Map();
  let site = {}, renderToken = 0, mediaObserver = null, guideCleanup = null, worldPosts = [], blogIndex = null;
  const postCache = new Map();
  const findProject = id => projectMap.get(id);
  const posterFor = entry => entry?.posterFrame || (entry?.thumbnailType === 'image' ? entry.thumbnail : '');
  const ingest = entries => { for(const entry of entries || []) { projectMap.set(entry.id,entry); if(!projects.some(p=>p.id===entry.id))projects.push(entry); } };
  async function loadData(path) {
    const response=await fetch(new URL('./data/'+path+'.json',import.meta.url));
    if(!response.ok)throw new Error('Could not load portfolio page');
    return response.json();
  }
  function navigateProject(id){ if(options.onNavigate)options.onNavigate('project/'+id);else showProject(id); }
  function navigateBlog(id=''){ if(options.onNavigate)options.onNavigate(id?'blog/'+id:'blog');else if(id)showPost(id);else showDestination('blog'); }
  async function prepareWorld(){ const data=await loadData('world');ingest(data.projects);worldPosts=data.posts||[]; }
  function observeMedia(){
    mediaObserver?.disconnect();
    mediaObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        const el=entry.target;
        if(entry.isIntersecting){
          if(el.dataset.source&&!el.src){el.src=el.dataset.source;}
          if(el.tagName==='VIDEO'&&entry.intersectionRatio>.2&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.play().catch(()=>{});
        }else if(el.tagName==='VIDEO')el.pause();
      }
    },{root:container,threshold:[0,.2,.5]});
    container.querySelectorAll('video,iframe[data-source]').forEach(el=>mediaObserver.observe(el));
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)container.querySelectorAll('video').forEach(video=>video.pause());});
  function clear() {
    mediaObserver?.disconnect(); guideCleanup?.(); guideCleanup=null;
    container.querySelectorAll('video').forEach(video => {video.pause();video.removeAttribute('src');video.load();});
    container.replaceChildren();
    delete container.dataset.content;
    container.scrollTo({ top: 0, behavior: 'instant' });
  }
  function heading(kicker, title, intro) {
    clear();
    const header = element('div', 'collection-heading');
    const h = element('h1', '', title); h.id = 'page-title';
    header.append(element('p', 'page-meta', kicker), h);
    if (intro) header.append(element('p', 'page-intro', intro));
    container.append(header);
  }
  function addGrid(ids) {
    const grid = element('div', 'project-grid');
    for (const p of ids.map(findProject).filter(Boolean)) {
      const button = element('a', 'project-card'); button.dataset.project = p.id;button.href=new URL('./project/'+p.id+'/',import.meta.url).href;
      const poster = posterFor(p);
      if (poster) {
        const img = element('img'); img.src = asset(poster); img.alt = pretty(p.heading || p.title); img.loading = 'lazy'; button.append(img);
      } else button.append(element('div', 'empty-art', pretty(p.heading || p.title)));
      const h = element('h3', '', pretty(p.heading || p.title)); h.append(element('span', '', '↗'));
      button.append(h, element('small', '', [p.period, p.layout==='media-fullscreen'?p.category:p.role || p.category].filter(Boolean).join(' / ')), element('p', '', p.description));
      button.addEventListener('click', event => {if(event.button||event.metaKey||event.ctrlKey||event.shiftKey)return;event.preventDefault();navigateProject(p.id);});
      grid.append(button);
    }
    container.append(grid);
  }
  function resume(data) {
    heading(data.name || 'David Svezhintsev', 'Résumé', data.summary);
    const header=container.querySelector('.collection-heading');
    if(data.headline)header.insertBefore(element('p','resume-headline',data.headline),header.querySelector('.page-intro'));
    const contacts=element('div','resume-contact');
    for(const [key,value] of Object.entries(data.contact||{})){
      if(!value)continue;
      const link=element('a','',key==='alternateWebsite'?'Previous portfolio ↗':value);
      link.href=key==='email'?'mailto:'+value:key==='phone'?'tel:'+value.replace(/[^+\d]/g,''):safeUrl(/^https?:/.test(value)?value:'https://'+value);
      contacts.append(link);
    }
    header.append(contacts);
    const downloads=element('div','resume-downloads');
    for(const version of data.versions||[]){
      const link=linkTo(version.download,version.title+' · PDF ↗');link.className='text-link';link.setAttribute('download','');downloads.append(link);
    }
    if(downloads.childNodes.length)header.append(downloads);
    const experience=element('section','resume-experience');experience.append(element('h2','resume-section-title','Experience'));
    for(const entry of data.experience||[]){
      const row=element('article','resume-row'),summary=element('div');row.dataset.experience=entry.id;
      row.append(element('small','',entry.period));summary.append(element('h3','',entry.organization),element('p','resume-role',entry.role));
      if(entry.bullets?.length){const bullets=element('ul');entry.bullets.forEach(text=>bullets.append(element('li','',text)));summary.append(bullets);}
      const links=element('div','resume-projects');
      for(const id of entry.projectIds||[]){const link=element('a','text-link',pretty(findProject(id)?.heading||id)+' ↗');link.href=new URL('./project/'+id+'/',import.meta.url).href;link.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey)return;event.preventDefault();navigateProject(id);});links.append(link);}
      summary.append(links);row.append(summary);experience.append(row);
    }
    container.append(experience);
    const details=element('div','resume-details');
    function section(title){const node=element('section');node.append(element('h2','resume-section-title',title));details.append(node);return node;}
    if(data.skills?.length){const skills=section('Skills & tools');for(const group of data.skills){skills.append(element('h3','',group.label),element('p','',group.items.join(', ')));}}
    if(data.community?.length){const community=section('Community');for(const item of data.community)community.append(element('h3','',item.title),element('p','',item.description));}
    if(data.clients?.length){const clients=section('Selected clients & collaborations');clients.append(element('p','',data.clients.join(' · ')));if(data.clientsNote)clients.append(element('p','resume-context',data.clientsNote));}
    for(const [key,title] of [['education','Education'],['languages','Languages']])if(data[key]?.length){const node=section(title);data[key].forEach(item=>node.append(element('p','',typeof item==='string'?item:[item.title,item.institution,item.period,item.description,item.name,item.level].filter(Boolean).join(' · '))));}
    container.append(details);
  }
  function contact() {
    heading('David Svezhintsev', 'Contact', site.contact?.intro);
    const grid = element('div', 'contact-grid'), info = element('aside', 'contact-info');
    for (const [label, text] of [['STATUS', site.contact?.availability], ['LOCATION', site.contact?.location]]) {
      const p = element('p', '', label); p.append(element('strong', '', text)); info.append(p);
    }
    const form = element('form', 'contact-form'); form.name = 'contact'; form.method = 'POST'; form.action = '/?page=contact&sent=1';
    form.setAttribute('data-netlify', 'true'); form.setAttribute('netlify-honeypot', 'bot-field');
    for (const [name, value] of [['form-name', 'contact'], ['subject', 'New portfolio inquiry from %{formName} (%{submissionId})']]) {
      const input = element('input'); input.type = 'hidden'; input.name = name; input.value = value; form.append(input);
    }
    const honeypot = element('label', 'form-honeypot', 'Leave empty');
    const bot = element('input'); bot.name = 'bot-field'; bot.tabIndex = -1; bot.autocomplete = 'off'; honeypot.setAttribute('aria-hidden', 'true'); honeypot.append(bot); form.append(honeypot);
    for (const [label, name, type] of [['Name', 'name', 'text'], ['Email', 'email', 'email'], ['Project type', 'project-type', 'select'], ['Message', 'message', 'textarea']]) {
      const field = element('label', '', label);
      const input = element(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input'); input.name = name; input.required = true;
      if (type === 'textarea') input.rows = 5;
      else if (type === 'select') for (const option of ['', 'WEBSITE', 'FILM', 'GAME', 'EXPERIMENT', 'APP', 'OTHER']) { const o = element('option', '', option || 'Select a project type'); o.value = option; input.append(o); }
      else { input.type = type; input.autocomplete = name; }
      field.append(input); form.append(field);
    }
    const send = element('button', '', 'Send message'); send.type = 'submit'; send.append(element('span', '', '↗'));
    const message = element('p'); message.setAttribute('role', 'status');
    form.append(send, message);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!form.reportValidity()) return;
      if (['localhost', '127.0.0.1'].includes(location.hostname)) { message.textContent = 'Messages are not sent from the local preview.'; return; }
      send.disabled = true; message.textContent = 'Sending…';
      try {
        const response = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() });
        if (!response.ok) throw new Error('Submission failed');
        form.reset(); message.textContent = 'Message received. Thank you.';
      } catch { message.textContent = 'Your message could not be sent. Please try again.'; }
      finally { send.disabled = false; }
    });
    grid.append(info, form); container.append(grid);
  }
  function articleDate(value) {
    const date=new Date(value+'T12:00:00');
    return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(date);
  }
  function postLink(post,className='blog-link') {
    const link=element('a',className);link.href=new URL('./blog/'+post.id+'/',import.meta.url).href;link.dataset.post=post.id;
    link.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigateBlog(post.id);});
    return link;
  }
  function blogList(posts) {
    const list=element('div','blog-list');
    for(const post of posts){
      const article=element('article','blog-entry'),date=element('time','blog-date',articleDate(post.date));date.dateTime=post.date;
      const link=postLink(post),title=element('h2','',post.title);title.append(element('span','','↗'));link.append(title,element('p','',post.summary));article.append(date,link);list.append(article);
    }
    return list;
  }
  async function showPost(id) {
    const token=++renderToken;let post=postCache.get(id);
    if(!post){post=await loadData('blog/'+id);postCache.set(id,post);if(postCache.size>4)postCache.delete(postCache.keys().next().value);}
    if(token!==renderToken)return;
    heading(articleDate(post.date),post.title,post.summary);container.dataset.content='blog-article';
    const back=element('a','blog-back','← All essays');back.href=new URL('./blog/',import.meta.url).href;
    back.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigateBlog();});
    container.querySelector('.collection-heading').prepend(back);
    onProjectChange(null,post.title,{sectionId:'blog'});
    appendBlocks(post.blocks||[],post);
    if(post.related?.length){const related=element('section','blog-related');related.append(element('h2','','More essays'),blogList(post.related));container.append(related);}
    observeMedia();
  }
  async function showDestination(id) {
    const def=destinations.find(d=>d.id===id);if(!def)return;
    const token=++renderToken,data=await loadData(id);if(token!==renderToken)return;
    ingest(data.projects);if(data.contact)site={contact:data.contact};
    if(id==='resume')resume(data.resume||{});
    else if(id==='contact')contact();
    else if(id==='blog'){blogIndex=data.posts||[];heading(`${String(blogIndex.length).padStart(2,'0')} essays`,def.title,def.intro);container.dataset.content='blog-index';container.append(blogList(blogIndex));}
    else{heading(`${String(def.projects.length).padStart(2,'0')} projects`,def.title,def.intro);addGrid(def.projects);}
    onProjectChange(null,def.label);
  }
  function appendBlocks(blocks,p) {
    const stream = element('div', 'block-stream');
    if (p.body) { const section = element('section', 'content-block'); section.append(element('p', '', p.body)); stream.append(section); }
    for (const block of blocks) {
      const section = element('section', `content-block ${block.width || 'full'}`), m = {};
      if(block.id)section.dataset.blockId=block.id;
      const source = block.source || m.sourcePath || m.externalUrl;
      if (block.heading) section.append(element(p.date?'h2':'h3', '', block.heading));
      if (block.body) section.append(element('p', '', block.body));
      if (block.type === 'image' && source) {
        const img = element('img'); img.src = asset(source); img.alt = block.alt || m.alt || block.heading || pretty(p.heading); img.loading = 'lazy'; if (block.fit === 'contain') img.style.objectFit = 'contain'; section.append(img);
      }
      if (block.type === 'video' && source) {
        const video = element('video'); video.dataset.source = asset(source); video.controls = true; video.playsInline = true; video.muted = true; video.loop = true; video.autoplay = !matchMedia('(prefers-reduced-motion: reduce)').matches; video.preload = 'none'; if (block.posterFrame || m.posterFrame) video.poster = asset(block.posterFrame || m.posterFrame); section.append(video);
      }
      if (block.type === 'youtube' && source) {
        try {
          const url = new URL(source), videoId = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.split('/').pop();
          if (/^[\w-]{11}$/.test(videoId)) { const iframe = element('iframe'); iframe.dataset.source = `https://www.youtube-nocookie.com/embed/${videoId}`; iframe.title = block.heading || 'Project video'; iframe.loading = 'lazy'; iframe.allowFullscreen = true; section.append(iframe); }
        } catch { /* Invalid video URLs do not block the rest of the project. */ }
      }
      if (block.type === 'link' && block.href) section.append(linkTo(block.href, block.label || block.heading || 'View project ↗'));
      if (block.type === 'project-link' && block.projectId) { const button = element('button', '', block.label || 'Open project ↗'); button.addEventListener('click', () => navigateProject(block.projectId)); section.append(button); }
      if (section.childNodes.length) stream.append(section);
    }
    container.append(stream);
  }
  async function showProject(id) {
    const token=++renderToken;
    let p=detailCache.get(id);
    if(!p){p=await loadData('projects/'+id);detailCache.set(id,p);if(detailCache.size>6)detailCache.delete(detailCache.keys().next().value);}
    if(token!==renderToken)return;
    ingest([p,...(p.children||[])]);
    heading([p.period,p.layout==='media-fullscreen'?p.category:p.role].filter(Boolean).join(' / '),pretty(p.heading||p.title),p.description);
    if(p.state&&p.layout!=='media-fullscreen')container.querySelector('.collection-heading').append(element('p','case-status',p.state));
    onProjectChange(id,pretty(p.heading||p.title),p);
    const blocks = [...(p.blocks || [])];
    if (!blocks.length && p.layout === 'media-fullscreen') blocks.push({ type: p.sourceType || 'image', source: p.source, mediaRef: p.mediaRef });
    appendBlocks(blocks,p);
    const children = (p.children||[]).filter(child => !child.hidden);
    if (children.length) addGrid(children.map(child => child.id));
    observeMedia();
    if(id==='lightkeeper'){const {attachCaseGuide}=await import('./dialogue.js');if(token===renderToken)guideCleanup=attachCaseGuide(container,id,{onAction:options.onAction,getActions:options.getActions,onGuideSection:blockId=>container.querySelector('[data-block-id='+CSS.escape(blockId)+']')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})});}
  }
  const previewVideo=id=>findProject(id)?.previewVideo||'';
  return {showDestination,showProject,showPost,blogPosts:()=>worldPosts,findProject,posterFor,previewVideo,prepareWorld,clear:()=>{renderToken++;clear();}};
}
