import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { seedPosts } from './src/posts.js'
import { renderArticlePage, renderHomePage, renderSitemap, siteOrigin } from './src/seo.js'

function staticArticles() {
  const origin = siteOrigin(process.env.SITE_URL || process.env.VITE_SITE_URL)

  return {
    name: 'stacked-static-articles',
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (!index) return
      const template = index.source
      index.source = renderHomePage(template, seedPosts, origin)
      for (const post of seedPosts) {
        this.emitFile({ type: 'asset', fileName: `articles/${post.id}/index.html`, source: renderArticlePage(template, post, origin) })
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}` })
      if (origin) this.emitFile({
        type: 'asset', fileName: 'sitemap.xml',
        source: renderSitemap(seedPosts, origin),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), staticArticles()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
