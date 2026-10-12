import express from 'express'
import { timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  exportDemo, importDemo, LIMITS, loadCatalog, prepareDemosDir, readDemoFile, readReadme, summarize,
} from './src/catalog.js'
import { renderDemoPage, renderHomePage, renderSitemap, siteOrigin } from './src/seo.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const ZIP_TYPES = ['application/zip', 'application/x-zip-compressed', 'application/x-zip', 'application/octet-stream']
const MAX_CONCURRENT_EXPORTS = 2

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
    this.expose = true
  }
}

const contentDisposition = (name) => {
  const fallback = name.replace(/[^\w.-]/g, '_')
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

function downloadHeaders(res, name, type) {
  res.set({
    'Content-Type': type,
    'Content-Disposition': contentDisposition(name),
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'Cache-Control': 'no-store',
  })
}

export async function createApp({
  bundledDir = path.join(root, 'demos'),
  demosDir = process.env.DEMOS_DIR || bundledDir,
  siteUrl = process.env.SITE_URL,
  publishKey = process.env.PUBLISH_KEY || '',
  template,
} = {}) {
  if (process.env.NODE_ENV === 'production' && !publishKey.trim()) {
    throw new Error('Set a non-empty PUBLISH_KEY before starting the production server.')
  }
  const app = express()
  const origin = siteOrigin(siteUrl)
  const canImport = await prepareDemosDir(demosDir)
  if (!canImport) console.warn(`Demo imports are disabled: ${demosDir} is not writable.`)

  let catalog = []
  const reload = async () => {
    const result = await loadCatalog({ bundledDir, demosDir })
    for (const warning of result.warnings) console.warn(warning)
    catalog = result.demos
  }
  await reload()

  let writes = Promise.resolve()
  let activeExports = 0
  const findDemo = (id) => catalog.find((demo) => demo.id === id)
  const getTemplate = template ? async () => template : async () => {
    const html = await readFile(path.join(root, 'dist/index.html'), 'utf8')
    return html.replace(/<link rel="canonical"[^>]*>/g, '')
  }

  app.disable('x-powered-by')
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin' })
    next()
  })
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }))

  app.get('/api/demos', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ demos: catalog.map(summarize), requiresKey: Boolean(publishKey), canImport })
  })

  app.get('/api/demos/:id', async (req, res) => {
    const demo = findDemo(req.params.id)
    if (!demo) throw new HttpError(404, 'Demo not found.')
    res.set('Cache-Control', 'no-store').json({ ...summarize(demo), files: demo.files, readme: await readReadme(demo) })
  })

  app.get('/api/demos/:id/files/*path', async (req, res) => {
    const demo = findDemo(req.params.id)
    const relativePath = req.params.path.join('/')
    const data = demo && await readDemoFile(demo, relativePath)
    if (!data) throw new HttpError(404, 'File not found.')
    downloadHeaders(res, path.posix.basename(relativePath), 'application/octet-stream')
    res.send(data)
  })

  app.get('/api/demos/:id/export', async (req, res) => {
    const demo = findDemo(req.params.id)
    if (!demo) throw new HttpError(404, 'Demo not found.')
    if (activeExports >= MAX_CONCURRENT_EXPORTS) throw new HttpError(503, 'Export is busy, please retry in a moment.')
    activeExports += 1
    try {
      const archive = await exportDemo(demo)
      downloadHeaders(res, `${demo.id}.zip`, 'application/zip')
      res.send(archive)
    } finally {
      activeExports -= 1
    }
  })

  app.post('/api/demos/import', (req, res, next) => {
    if (req.get('origin')) {
      let sameOrigin = false
      try {
        sameOrigin = new URL(req.get('origin')).host === req.get('host')
      } catch {
        throw new HttpError(403, 'Invalid request origin.')
      }
      if (!sameOrigin) throw new HttpError(403, 'Import from this site, not another origin.')
    }
    if (publishKey) {
      const supplied = Buffer.from(req.get('x-publish-key') || '')
      const expected = Buffer.from(publishKey)
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new HttpError(401, 'A valid publishing key is required.')
    }
    if (!canImport) throw new HttpError(503, 'Importing is disabled because the demo directory is not writable.')
    const matches = req.is(ZIP_TYPES)
    if (matches === null || req.get('content-length') === '0') throw new HttpError(400, 'Choose a .zip archive to import.')
    if (!matches) throw new HttpError(415, 'Upload a .zip archive.')
    next()
  }, express.raw({ type: ZIP_TYPES, limit: LIMITS.archiveBytes }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Choose a .zip archive to import.')
    const replace = ['1', 'true'].includes(String(req.query.replace))
    const work = writes.then(async () => {
      const id = await importDemo(req.body, { demosDir, demos: catalog, replace })
      await reload()
      return id
    })
    writes = work.catch(() => {})
    const id = await work
    res.status(201).json(summarize(findDemo(id)))
  })

  app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }))

  app.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-cache').type('html').send(renderHomePage(await getTemplate(), catalog, origin))
  })
  app.get('/catalog/:id/', async (req, res) => {
    const demo = findDemo(req.params.id)
    if (!demo) return res.status(404).type('html').send('<h1>Demo not found</h1><a href="/">Back to the demo catalog</a>')
    res.set('Cache-Control', 'no-cache').type('html').send(renderDemoPage(await getTemplate(), demo, await readReadme(demo), origin))
  })
  app.get('/articles/*path', (req, res) => res.redirect(301, '/'))
  app.get('/sitemap.xml', (req, res) => {
    if (!origin) return res.status(404).send('Set SITE_URL to enable the sitemap.')
    res.type('application/xml').send(renderSitemap(catalog, origin))
  })
  app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nAllow: /\nDisallow: /api/\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`))
  app.use(express.static(path.join(root, 'dist'), { index: false }))
  app.use((req, res) => res.status(404).type('html').send('<h1>Page not found</h1><a href="/">Back to the demo catalog</a>'))
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error.type === 'entity.too.large') return res.status(413).json({ error: `The archive is larger than the ${LIMITS.archiveBytes / (1024 * 1024)} MB import limit.` })
    if (error.expose && error.status >= 400 && error.status < 600 && !error.type) return res.status(error.status).json({ error: error.message })
    if (!error.status || error.status >= 500) console.error(error)
    res.status(error.status && error.status < 500 ? error.status : 500).json({ error: 'Something went wrong. Please try again.' })
  })
  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const app = await createApp()
  const port = Number(process.env.PORT || 3000)
  app.listen(port, () => console.log(`Stacked demo catalog is running at http://localhost:${port}`))
}
