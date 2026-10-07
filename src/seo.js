export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]))

export function siteOrigin(value) {
  if (!value) return null
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('SITE_URL must be an HTTP(S) URL')
  return url.origin
}

function replaceRoot(template, content) {
  return template.replace(/<div id="root">[\s\S]*?<\/div>/, () => `<div id="root">${content}</div>`)
}

export function renderHomePage(template, posts, origin) {
  const content = `<main><h1>Stacked — Ideas for a better-built web</h1><p>Fresh perspectives on development, AI, design, cloud tools, and security.</p>${posts.map((post) => `<article><h2><a href="/articles/${escapeHtml(post.id)}/">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.excerpt)}</p><p>${post.tags.map(escapeHtml).join(', ')}</p></article>`).join('')}</main>`
  let html = replaceRoot(template, content)
  if (origin) html = html.replace('</head>', () => `<link rel="canonical" href="${escapeHtml(origin)}/" /></head>`)
  return html
}

export function renderArticlePage(template, post, origin) {
  const path = `/articles/${post.id}/`
  const title = escapeHtml(`${post.title} — Stacked`)
  const body = post.body.split(/\n\n+/).map((block) => {
    if (!block.startsWith('## ')) return `<p>${escapeHtml(block)}</p>`
    const [heading, ...lines] = block.split('\n')
    return `<h2>${escapeHtml(heading.slice(3))}</h2>${lines.length ? `<p>${escapeHtml(lines.join('\n'))}</p>` : ''}`
  }).join('')
  const content = `<article><a href="/">Stacked — All articles</a><h1>${escapeHtml(post.title)}</h1><p>${escapeHtml(post.excerpt)}</p><p>By ${escapeHtml(post.author)} · <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time></p><p>${post.tags.map(escapeHtml).join(', ')}</p>${body}</article>`
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
    description: post.excerpt, datePublished: post.date, author: { '@type': 'Person', name: post.author },
    keywords: post.tags.join(', '), ...(origin ? { url: `${origin}${path}`, mainEntityOfPage: `${origin}${path}` } : {}),
  }).replace(/</g, '\\u003c')
  let html = replaceRoot(template, content)
    .replace(/<title>.*?<\/title>/, () => `<title>${title}</title>`)
    .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*"/g, (_, prefix) => `${prefix}${escapeHtml(post.excerpt)}"`)
    .replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*"/g, (_, prefix) => `${prefix}${title}"`)
    .replace(/(<meta name="keywords" content=")[^"]*"/, (_, prefix) => `${prefix}${escapeHtml(post.tags.join(', '))}"`)
    .replace('content="website"', 'content="article"')
    .replace(/<link rel="canonical"[^>]*>/g, '')
    .replace('</head>', () => `<meta property="article:published_time" content="${escapeHtml(post.date)}" /><script type="application/ld+json">${structuredData}</script></head>`)
  if (origin) html = html.replace('</head>', () => `<link rel="canonical" href="${escapeHtml(origin + path)}" /><meta property="og:url" content="${escapeHtml(origin + path)}" /></head>`)
  return html
}

export function renderSitemap(posts, origin) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(origin)}/</loc></url>${posts.map((post) => `<url><loc>${escapeHtml(origin)}/articles/${escapeHtml(post.id)}/</loc><lastmod>${escapeHtml(post.date)}</lastmod></url>`).join('')}</urlset>`
}
