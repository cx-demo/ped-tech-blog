import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { loadCatalog, readReadme } from './src/catalog.js'
import { renderDemoPage, renderHomePage, renderSitemap, siteOrigin } from './src/seo.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const demosDir = path.join(root, 'demos')

function staticCatalog() {
  const origin = siteOrigin(process.env.SITE_URL || process.env.VITE_SITE_URL)

  return {
    name: 'stacked-static-catalog',
    enforce: 'post',
    async generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (!index) return
      const template = index.source
      const { demos, warnings } = await loadCatalog({ bundledDir: demosDir, demosDir })
      for (const warning of warnings) this.warn(warning)
      index.source = renderHomePage(template, demos, origin)
      for (const demo of demos) {
        this.emitFile({ type: 'asset', fileName: `catalog/${demo.id}/index.html`, source: renderDemoPage(template, demo, await readReadme(demo), origin) })
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /api/\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}` })
      if (origin) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap(demos, origin) })
    },
  }
}

export default defineConfig({
  plugins: [react(), staticCatalog()],
  // Demo folders contain their own HTML; only the app entry is scanned for dependencies.
  optimizeDeps: { entries: ['index.html'] },
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
