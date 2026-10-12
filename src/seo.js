import { parseMarkdown } from './markdown.js'

export const SITE_TITLE = 'Stacked — Demo catalog'
export const SITE_DESCRIPTION = 'Browse, search, export, and import ready-to-run technology demos. Each demo bundles its resources and a manifest in one portable archive.'

export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]))

export const demoPath = (id) => `/catalog/${encodeURIComponent(id)}/`

export function siteOrigin(value) {
  if (!value) return null
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('SITE_URL must be an HTTP(S) URL')
  return url.origin
}

function replaceRoot(template, content) {
  return template.replace(/<div id="root">[\s\S]*?<\/div>/, () => `<div id="root">${content}</div>`)
}

const inline = (text) => escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>')

export function renderMarkdownHtml(source) {
  return parseMarkdown(source).map((block) => {
    if (block.type === 'heading') return `<h${block.level + 1}>${inline(block.text)}</h${block.level + 1}>`
    if (block.type === 'list') {
      const tag = block.ordered ? 'ol' : 'ul'
      return `<${tag}>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`
    }
    if (block.type === 'code') return `<pre><code>${escapeHtml(block.text)}</code></pre>`
    return `<p>${inline(block.text)}</p>`
  }).join('')
}

export function renderHomePage(template, demos, origin) {
  const content = `<main><h1>${escapeHtml(SITE_TITLE)}</h1><p>${escapeHtml(SITE_DESCRIPTION)}</p>${demos.map((demo) => `<article><h2><a href="${demoPath(demo.id)}">${escapeHtml(demo.title)}</a></h2><p>${escapeHtml(demo.description)}</p><p>${demo.tags.map(escapeHtml).join(', ')}</p></article>`).join('')}</main>`
  let html = replaceRoot(template, content)
  if (origin) html = html.replace('</head>', () => `<link rel="canonical" href="${escapeHtml(origin)}/" /></head>`)
  return html
}

export function renderDemoPage(template, demo, readme, origin) {
  const pagePath = demoPath(demo.id)
  const title = escapeHtml(`${demo.title} — Stacked demos`)
  const files = `<h2>Files</h2><ul>${demo.files.map((file) => `<li>${escapeHtml(file.path)}</li>`).join('')}</ul>`
  const content = `<article><a href="/">Stacked — All demos</a><h1>${escapeHtml(demo.title)}</h1><p>${escapeHtml(demo.description)}</p>${demo.author ? `<p>By ${escapeHtml(demo.author)}</p>` : ''}<p>Updated <time datetime="${escapeHtml(demo.updated)}">${escapeHtml(demo.updated)}</time></p><p>${demo.tags.map(escapeHtml).join(', ')}</p><p><a href="/api/demos/${encodeURIComponent(demo.id)}/export">Download demo archive (.zip)</a></p>${readme ? renderMarkdownHtml(readme.text) : ''}${files}</article>`
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: demo.title,
    description: demo.description, dateModified: demo.updated, keywords: demo.tags.join(', '),
    ...(demo.author ? { author: { '@type': 'Person', name: demo.author } } : {}),
    ...(origin ? { url: `${origin}${pagePath}` } : {}),
  }).replace(/</g, '\\u003c')
  let html = replaceRoot(template, content)
    .replace(/<title>.*?<\/title>/, () => `<title>${title}</title>`)
    .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*"/g, (_, prefix) => `${prefix}${escapeHtml(demo.description)}"`)
    .replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*"/g, (_, prefix) => `${prefix}${title}"`)
    .replace(/(<meta name="keywords" content=")[^"]*"/, (_, prefix) => `${prefix}${escapeHtml(demo.tags.join(', '))}"`)
    .replace('content="website"', 'content="article"')
    .replace(/<link rel="canonical"[^>]*>/g, '')
    .replace('</head>', () => `<script type="application/ld+json">${structuredData}</script></head>`)
  if (origin) html = html.replace('</head>', () => `<link rel="canonical" href="${escapeHtml(origin + pagePath)}" /><meta property="og:url" content="${escapeHtml(origin + pagePath)}" /></head>`)
  return html
}

export function renderSitemap(demos, origin) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(origin)}/</loc></url>${demos.map((demo) => `<url><loc>${escapeHtml(origin + demoPath(demo.id))}</loc><lastmod>${escapeHtml(demo.updated)}</lastmod></url>`).join('')}</urlset>`
}
