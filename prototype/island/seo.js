export const SITE_ORIGIN = 'https://davidsvez.com';
export const SITE_NAME = 'David Svezhintsev';
export const HOME_TITLE = 'David Svezhintsev — Design & Development';
export const HOME_DESCRIPTION = 'David Svezhintsev’s portfolio: product and UX design, design engineering, game development, film, and creative tools.';
export const SOCIAL_IMAGE = SITE_ORIGIN + '/assets/social-cover.jpg';
export const SOCIAL_IMAGE_ALT = 'David Svezhintsev’s red logo over a game environment';
export const FAVICON = '/assets/favicon_2gyS6VcfqH9mnET_OQfwI.ico';

export function canonicalUrl(path = '/') {
  const url = new URL(path, SITE_ORIGIN + '/');
  let pathname = url.pathname.replace(/\/index\.html$/i, '/');
  if (['/', '/island', '/island/'].includes(pathname)) pathname = '/';
  else if (!pathname.endsWith('/')) pathname += '/';
  return SITE_ORIGIN + pathname;
}

function plainText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function descriptionText(value) {
  const text = plainText(value || HOME_DESCRIPTION);
  return text.length > 240 ? text.slice(0, 237).replace(/\s+\S*$/, '') + '…' : text;
}

export function seoData({ path = '/', title, description, kind = 'page', datePublished, items = [] } = {}) {
  const canonical = canonicalUrl(path);
  const home = canonical === SITE_ORIGIN + '/';
  const fullTitle = home ? HOME_TITLE : `${plainText(title || SITE_NAME)} — ${SITE_NAME}`;
  const summary = descriptionText(home ? HOME_DESCRIPTION : description);
  const websiteId = SITE_ORIGIN + '/#website', personId = SITE_ORIGIN + '/#person';
  const pageId = canonical + '#webpage';
  const graph = [
    { '@type': 'Person', '@id': personId, name: SITE_NAME, url: SITE_ORIGIN + '/', jobTitle: 'Product Designer / Design Engineer' },
    { '@type': 'WebSite', '@id': websiteId, name: SITE_NAME, url: SITE_ORIGIN + '/', description: HOME_DESCRIPTION, publisher: { '@id': personId }, inLanguage: 'en' },
  ];
  const page = {
    '@type': home || kind === 'profile' ? 'ProfilePage' : kind === 'contact' ? 'ContactPage' : ['collection', 'blog'].includes(kind) ? 'CollectionPage' : 'WebPage',
    '@id': pageId, url: canonical, name: fullTitle, description: summary,
    isPartOf: { '@id': websiteId }, author: { '@id': personId }, inLanguage: 'en',
  };
  if (home || kind === 'profile') page.mainEntity = { '@id': personId };
  if (kind === 'blog' || kind === 'article') {
    const blogUrl = SITE_ORIGIN + '/island/blog/';
    graph.push({ '@type': 'Blog', '@id': blogUrl + '#blog', url: blogUrl, name: 'David Svezhintsev’s blog', description: 'Essays on game development and creative production.', publisher: { '@id': personId }, inLanguage: 'en' });
    if (kind === 'blog') page.mainEntity = { '@id': blogUrl + '#blog' };
  }
  if (kind === 'article') {
    const article = {
      '@type': 'BlogPosting', '@id': canonical + '#article', url: canonical,
      headline: plainText(title), description: summary, image: SOCIAL_IMAGE,
      author: { '@id': personId }, publisher: { '@id': personId },
      mainEntityOfPage: { '@id': pageId }, isPartOf: { '@id': SITE_ORIGIN + '/island/blog/#blog' }, inLanguage: 'en',
    };
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePublished || '')) article.datePublished = datePublished;
    graph.push(article); page.mainEntity = { '@id': article['@id'] };
  } else if (items.length && kind === 'collection') {
    page.mainEntity = { '@type': 'ItemList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: plainText(item.name || item.heading || item.title), url: canonicalUrl(item.path || `/island/project/${item.id}/`) })) };
  }
  graph.push(page);
  return {
    title: fullTitle, description: summary, canonical, type: kind === 'article' ? 'article' : 'website',
    structuredData: { '@context': 'https://schema.org', '@graph': graph },
  };
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function metaEntries(data) {
  return [
    ['name', 'description', data.description], ['name', 'author', SITE_NAME], ['name', 'robots', 'index, follow, max-image-preview:large'],
    ['property', 'og:type', data.type], ['property', 'og:site_name', SITE_NAME], ['property', 'og:title', data.title],
    ['property', 'og:description', data.description], ['property', 'og:url', data.canonical], ['property', 'og:image', SOCIAL_IMAGE],
    ['property', 'og:image:type', 'image/jpeg'], ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'], ['property', 'og:image:alt', SOCIAL_IMAGE_ALT],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', data.title], ['name', 'twitter:description', data.description],
    ['name', 'twitter:image', SOCIAL_IMAGE], ['name', 'twitter:image:alt', SOCIAL_IMAGE_ALT],
  ];
}

export function renderSeoHead(options = {}) {
  const data = seoData(options);
  const lines = [
    '<!-- site-seo:start -->',
    `<title data-site-seo="title">${escapeHtml(data.title)}</title>`,
    ...metaEntries(data).map(([attribute, key, value]) => `<meta data-site-seo="${key}" ${attribute}="${key}" content="${escapeHtml(value)}">`),
    `<link data-site-seo="canonical" rel="canonical" href="${escapeHtml(data.canonical)}">`,
    `<link data-site-seo="icon" rel="icon" type="image/x-icon" href="${FAVICON}">`,
    `<link data-site-seo="shortcut-icon" rel="shortcut icon" type="image/x-icon" href="${FAVICON}">`,
    `<script data-site-seo="structured" type="application/ld+json">${scriptJson(data.structuredData)}</script>`,
    '<!-- site-seo:end -->',
  ];
  return lines.map(line => '  ' + line).join('\n');
}

export function applySeoToHtml(html, options = {}) {
  return html.replace(/<head\b([^>]*)>([\s\S]*?)<\/head>/i, (_, attributes, originalHead) => {
    const head = originalHead
      .replace(/\s*<!-- site-seo:start -->[\s\S]*?<!-- site-seo:end -->\s*/g, '\n')
      .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi, '')
      .replace(/<meta\b(?=[^>]*(?:name|property)\s*=\s*["'](?:description|author|robots|og:[^"']*|twitter:[^"']*)["'])[^>]*>\s*/gi, '')
      .replace(/<link\b(?=[^>]*rel\s*=\s*["'](?:canonical|icon|shortcut icon)["'])[^>]*>\s*/gi, '')
      .replace(/<script\b(?=[^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>\s*/gi, '')
      .trim();
    return `<head${attributes}>\n  ${head}\n${renderSeoHead(options)}\n</head>`;
  });
}

export function updateDocumentSeo(options = {}) {
  const data = seoData(options);
  const ensureMeta = (attribute, key) => {
    const matches = [...document.head.querySelectorAll(`meta[${attribute}="${key}"]`)];
    const element = matches.shift() || document.createElement('meta');
    matches.forEach(item => item.remove()); element.setAttribute(attribute, key); element.dataset.siteSeo = key;
    if (!element.parentNode) document.head.append(element);
    return element;
  };
  document.title = data.title;
  for (const [attribute, key, value] of metaEntries(data)) ensureMeta(attribute, key).content = value;
  const canonicals = [...document.head.querySelectorAll('link[rel="canonical"]')];
  const canonical = canonicals.shift() || document.createElement('link'); canonicals.forEach(item => item.remove());
  canonical.rel = 'canonical'; canonical.href = data.canonical; canonical.dataset.siteSeo = 'canonical'; if (!canonical.parentNode) document.head.append(canonical);
  document.head.querySelectorAll('script[type="application/ld+json"][data-site-seo="structured"]').forEach(item => item.remove());
  const script = document.createElement('script'); script.type = 'application/ld+json'; script.dataset.siteSeo = 'structured'; script.textContent = scriptJson(data.structuredData); document.head.append(script);
  return data;
}
