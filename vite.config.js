import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { seedPosts } from './src/posts.js'

const escapeHtml = (text) => text.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]))

function staticArticles() {
  const configuredUrl = process.env.VITE_SITE_URL
  const origin = configuredUrl ? new URL(configuredUrl).origin : null
  if (origin && !/^https?:\/\//.test(origin)) throw new Error('VITE_SITE_URL must be an HTTP(S) URL')

  return {
    name: 'stacked-static-articles',
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (!index) return
      const template = index.source
      const homeContent = `<main><h1>Stacked — Ideas for a better-built web</h1><p>Fresh perspectives on development, AI, design, cloud tools, and security.</p>${seedPosts.map((post) => `<article><h2><a href="/articles/${post.id}/">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.excerpt)}</p><p>${post.tags.map(escapeHtml).join(', ')}</p></article>`).join('')}</main>`
      index.source = template.replace('<div id="root"></div>', () => `<div id="root">${homeContent}</div>`)
      if (origin) index.source = index.source.replace('</head>', `<link rel="canonical" href="${escapeHtml(origin)}/" /></head>`)
      for (const post of seedPosts) {
        const path = `/articles/${post.id}/`
        const title = escapeHtml(`${post.title} — Stacked`)
        const body = post.body.split(/\n\n+/).map((block) => {
          if (!block.startsWith('## ')) return `<p>${escapeHtml(block)}</p>`
          const [heading, ...lines] = block.split('\n')
          return `<h2>${escapeHtml(heading.slice(3))}</h2>${lines.length ? `<p>${escapeHtml(lines.join('\n'))}</p>` : ''}`
        }).join('')
        const content = `<article><a href="/">Stacked — All articles</a><h1>${escapeHtml(post.title)}</h1><p>${escapeHtml(post.excerpt)}</p><p>By ${escapeHtml(post.author)} · <time datetime="${post.date}">${post.date}</time></p><p>${post.tags.map(escapeHtml).join(', ')}</p>${body}</article>`
        const structuredData = JSON.stringify({
          '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
          description: post.excerpt, datePublished: post.date, author: { '@type': 'Person', name: post.author },
          keywords: post.tags.join(', '), ...(origin ? { url: `${origin}${path}`, mainEntityOfPage: `${origin}${path}` } : {}),
        }).replace(/</g, '\\u003c')
        let html = template.replace(/<title>.*?<\/title>/, () => `<title>${title}</title>`)
          .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*"/g, (_, prefix) => `${prefix}${escapeHtml(post.excerpt)}"`)
          .replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*"/g, (_, prefix) => `${prefix}${title}"`)
          .replace(/(<meta name="keywords" content=")[^"]*"/, (_, prefix) => `${prefix}${escapeHtml(post.tags.join(', '))}"`)
          .replace('content="website"', 'content="article"')
          .replace('<div id="root"></div>', () => `<div id="root">${content}</div>`)
          .replace('</head>', () => `<meta property="article:published_time" content="${post.date}" /><script type="application/ld+json">${structuredData}</script></head>`)
        if (origin) html = html.replace('</head>', `<link rel="canonical" href="${escapeHtml(origin + path)}" /><meta property="og:url" content="${escapeHtml(origin + path)}" /></head>`)
        this.emitFile({ type: 'asset', fileName: `articles/${post.id}/index.html`, source: html })
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}` })
      if (origin) this.emitFile({
        type: 'asset', fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(origin)}/</loc></url>${seedPosts.map((post) => `<url><loc>${escapeHtml(origin)}/articles/${post.id}/</loc><lastmod>${post.date}</lastmod></url>`).join('')}</urlset>`,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), staticArticles()],
})
