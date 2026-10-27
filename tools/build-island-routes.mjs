import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const collections = {
  product: { path: 'product-design', title: 'Product design', projects: ['userwise', 'flax-editor', 'earthwallet', 'yogajoint'], description: 'Product and UX design for content authoring, developer tools, and mobile services.' },
  games: { path: 'technical-design', title: 'Technical game design', projects: ['lightkeeper', 'kern', 'swamp-fellas', 'prototypes', 'game-jams'], description: 'Game design and development across exploration, investigation, and multiplayer prototypes, with the tools behind them.' },
  resume: { path: 'resume', title: 'Résumé', projects: ['kern', 'flax-editor', 'lightkeeper', 'dronies', 'daedalus', 'userwise'], description: 'Experience across product design, game design, development, and creative direction.' },
  archive: { path: 'case-studies', title: 'Other case studies', projects: ['daedalus', 'dronies', 'apps', 'visual-lab', 'marathon-tau-ceti', 'client-work'], description: 'Other work in film, storytelling, motion, and interactive experiments.' },
  contact: { path: 'contact', title: 'Contact', projects: [], description: 'Contact David Svezhintsev about a project.' },
  blog: { path: 'blog', title: 'Blog', projects: [], description: 'Essays on game development and creative production.' },
};
const worldIds = [...new Set([
  ...collections.product.projects.slice(0, 2),
  ...collections.games.projects.slice(0, 2),
  ...collections.archive.projects.slice(0, 3),
])];
const validId = /^[a-z0-9][a-z0-9-]*$/;

function publicString(value) {
  if (typeof value !== 'string') return value;
  if (/^[a-z]:[\\/]/i.test(value) || /(?:^|[\\/])og-library[\\/]/i.test(value)) return '';
  return value;
}

// Source files remain authoritative. Only the generated public bundles are
// sanitized; original/private library paths never enter these route responses.
function publicCopy(value) {
  if (typeof value === 'string') return publicString(value);
  if (Array.isArray(value)) return value.map(publicCopy);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['originalSourcePath', 'originalSource', 'privatePath'].includes(key))
    .map(([key, entry]) => [key, publicCopy(entry)]));
}

function cleanRecoveryNotes(project) {
  const result = publicCopy(project);
  for (const block of result.blocks || []) {
    if (project.id === 'flax-editor' && typeof block.body === 'string') {
      block.body = block.body.replace(
        'Exact merged PR and commit links still need to be recovered; no fork-only change should be read as an official Flax feature.',
        'Fork-only changes shown here are not official Flax features.',
      );
    }
    if (project.id === 'swamp-fellas' && typeof block.body === 'string') {
      block.body = block.body.replace(/\s*Historical audience metrics still need verification\./g, '');
    }
  }
  return result;
}

function resolveItem(item, mediaById) {
  const media = mediaById.get(item.mediaRef);
  if (!media) return publicCopy(item);
  return publicCopy({
    ...item,
    source: publicString(media.sourcePath) || publicString(media.externalUrl) || publicString(item.source) || '',
    alt: item.alt || media.alt || media.title || '',
    posterFrame: item.posterFrame || media.posterFrame || '',
    mediaWidth: Number(item.mediaWidth) || Number(media.width) || 0,
    mediaHeight: Number(item.mediaHeight) || Number(media.height) || 0,
    aspectRatio: item.aspectRatio || media.aspectRatio || '',
  });
}

function metadata(project, mediaById) {
  const media = mediaById.get(project.thumbnailMediaRef);
  const thumbnail = publicString(media?.sourcePath) || publicString(media?.externalUrl) || publicString(project.thumbnail) || '';
  const thumbnailType = media?.type === 'video' || (!media && project.thumbnailType === 'video') ? 'video' : 'image';
  return {
    id: project.id,
    parentId: project.parentId || null,
    layout: project.layout || 'folder',
    title: project.title || project.heading || project.id,
    heading: project.heading || project.title || project.id,
    description: project.description || '',
    role: project.role || '',
    state: project.state || '',
    period: project.period || '',
    category: project.category || '',
    thumbnailType,
    thumbnail,
    posterFrame: publicString(project.posterFrame) || publicString(media?.posterFrame) || '',
    previewVideo: thumbnailType === 'video' ? thumbnail : '',
  };
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function routeHtml(shell, title, description) {
  return shell
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)} — David Svezhintsev</title>`)
    .replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?\s*>/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/\b(src|href)=(['"])\.\//g, '$1=$2/island/')
    .replace(/\bhref=(['"])\.\.\//g, 'href=$1/');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function buildIslandRoutes({ root = repositoryRoot } = {}) {
  const prototype = join(root, 'prototype');
  const island = join(prototype, 'island');
  const dataDirectory = join(island, 'data');
  const [sourceProjects, sourceMedia, site, shell, resume] = await Promise.all([
    readJson(join(prototype, 'content/projects.json')),
    readJson(join(prototype, 'content/media.json')),
    readJson(join(prototype, 'content/site.json')),
    readFile(join(island, 'index.html'), 'utf8'),
    readJson(join(island, 'content/resume.json')),
  ]);
  if (!Array.isArray(sourceProjects) || !Array.isArray(sourceMedia)) throw new Error('Projects and media must be arrays.');
  const mediaById = new Map(sourceMedia.map(item => [item.id, item]));
  const projectsById = new Map();
  for (const project of sourceProjects) {
    if (!validId.test(project.id)) throw new Error(`Unsafe project id: ${project.id}`);
    if (projectsById.has(project.id)) throw new Error(`Duplicate project id: ${project.id}`);
    projectsById.set(project.id, project);
  }
  let overrides = [];
  try { overrides = await readdir(join(island, 'content')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const file of overrides.filter(name => name.endsWith('.json')).sort()) {
    const id = file.slice(0, -5);
    if (!projectsById.has(id)) continue;
    const override = await readJson(join(island, 'content', file));
    if (override.id && override.id !== id) throw new Error(`Override id mismatch: ${file}`);
    projectsById.set(id, { ...projectsById.get(id), ...override, id });
  }
  const projects = [...projectsById.values()].filter(project => !project.hidden).map(cleanRecoveryNotes);
  const metadataById = new Map(projects.map(project => [project.id, metadata(project, mediaById)]));
  function sectionForProject(project) {
    const visited = new Set();
    for (let node = project; node && !visited.has(node.id); node = projectsById.get(node.parentId)) {
      visited.add(node.id);
      for (const [id, collection] of Object.entries(collections)) {
        if (id !== 'resume' && collection.projects.includes(node.id)) return id;
      }
    }
    return project.category === 'GAME' ? 'games' : 'archive';
  }
  function requiredMetadata(id) {
    const item = metadataById.get(id);
    if (!item) throw new Error(`Collection references a missing or hidden project: ${id}`);
    return item;
  }
  const files = new Map();
  const json = value => `${JSON.stringify(value)}\n`;
  const routeMap = {};
  const posts=(site.blog||[]).filter(post=>post.published===true).map(publicCopy).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const postIds=new Set();
  for(const post of posts){if(!validId.test(post.id)||postIds.has(post.id))throw new Error(`Invalid or duplicate blog id: ${post.id}`);postIds.add(post.id);}
  const postMetadata=posts.map(post=>({id:post.id,title:post.title,date:post.date,summary:post.summary||''}));
  for (const [id, collection] of Object.entries(collections)) {
    const ids=id==='resume'?[...new Set([...(collection.projects||[]),...(resume.experience||[]).flatMap(entry=>entry.projectIds||[])])]:collection.projects;
    const value = { projects: ids.map(requiredMetadata) };
    if (id === 'resume') {
      const {sourceNotes,...publicResume}=publicCopy(resume);
      publicResume.experience=(publicResume.experience||[]).map(({sourceIds,dateVariants,...entry})=>entry);
      value.resume=publicResume;
    }
    if (id === 'contact') value.contact = publicCopy(site.contact || {});
    if (id === 'blog') value.posts = postMetadata;
    files.set(`data/${id}.json`, json(value));
    files.set(`${collection.path}/index.html`, routeHtml(shell, collection.title, id === 'contact' ? site.contact?.intro || collection.description : collection.description));
    routeMap[id] = `/island/${collection.path}/`;
  }
  files.set('data/world.json', json({ projects: worldIds.map(requiredMetadata), posts:postMetadata.slice(0,3) }));
  for(const post of posts){
    const value={...post,blocks:(post.blocks||[]).map(block=>resolveItem(block,mediaById)),related:postMetadata.filter(other=>other.id!==post.id).slice(0,2)};
    files.set(`data/blog/${post.id}.json`,json(value));
    files.set(`blog/${post.id}/index.html`,routeHtml(shell,post.title,post.summary));
  }
  for (const project of projects) {
    const meta = requiredMetadata(project.id);
    const resolved = resolveItem(project, mediaById);
    const value = {
      ...resolved,
      sectionId: sectionForProject(project),
      thumbnail: meta.thumbnail,
      thumbnailType: meta.thumbnailType,
      posterFrame: meta.posterFrame,
      previewVideo: meta.previewVideo,
      blocks: (project.blocks || []).map(block => resolveItem(block, mediaById)),
      children: projects.filter(child => child.parentId === project.id).map(child => requiredMetadata(child.id)),
    };
    files.set(`data/projects/${project.id}.json`, json(value));
    files.set(`project/${project.id}/index.html`, routeHtml(shell, project.heading || project.title || project.id, project.description));
  }
  const manifestPath = join(dataDirectory, '.route-manifest.json');
  let previous = [];
  try { previous = await readJson(manifestPath); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Remove only files recorded by this generator, never authored source files.
  for (const name of previous) {
    if (files.has(name)) continue;
    if (typeof name !== 'string' || (!name.startsWith('data/') && !name.endsWith('/index.html'))) throw new Error('Invalid generated-route manifest entry.');
    const target = resolve(island, name);
    if (!target.startsWith(resolve(island) + sep)) throw new Error('Generated-route path escaped the island directory.');
    await unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  for (const [name, content] of files) {
    const target = join(island, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  await writeFile(manifestPath, json([...files.keys()].sort()), 'utf8');
  return { routes: routeMap, projectRoutes: projects.length, blogRoutes:posts.length, files: files.size, dataDirectory: relative(root, dataDirectory) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildIslandRoutes();
  console.log(`Generated ${Object.keys(result.routes).length} collection routes, ${result.projectRoutes} project routes and ${result.blogRoutes} blog articles (${result.files} files).`);
  console.log(JSON.stringify(result.routes));
}
