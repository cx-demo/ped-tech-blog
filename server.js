import express from 'express'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isValidPost, seedPosts, validateInput } from './src/posts.js'
import { renderArticlePage, renderHomePage, renderSitemap, siteOrigin } from './src/seo.js'

const root = path.dirname(fileURLToPath(import.meta.url))

export async function createApp({
  dataDir = process.env.DATA_DIR || path.join(root, 'data'),
  siteUrl = process.env.SITE_URL,
  publishKey = process.env.PUBLISH_KEY || '',
} = {}) {
  if (process.env.NODE_ENV === 'production' && !publishKey.trim()) {
    throw new Error('Set a non-empty PUBLISH_KEY before starting the production server.')
  }
  const app = express()
  const origin = siteOrigin(siteUrl)
  const file = path.join(dataDir, 'posts.json')
  let published = []
  try {
    const stored = JSON.parse(await readFile(file, 'utf8'))
    if (!Array.isArray(stored) || !stored.every(isValidPost)) throw new Error('Invalid posts data')
    published = stored
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  let writes = Promise.resolve()
  const allPosts = () => [...published, ...seedPosts]
  const template = async () => {
    const html = await readFile(path.join(root, 'dist/index.html'), 'utf8')
    return html.replace(/<link rel="canonical"[^>]*>/g, '')
  }
  app.disable('x-powered-by')
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin' })
    next()
  })
  app.use(express.json({ limit: '128kb' }))
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }))
  app.get('/api/posts', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ posts: allPosts(), requiresKey: Boolean(publishKey) })
  })
  app.post('/api/posts', async (req, res) => {
    if (req.get('origin')) {
      try {
        if (new URL(req.get('origin')).host !== req.get('host')) return res.status(403).json({ error: 'Publish from this site, not another origin.' })
      } catch {
        return res.status(403).json({ error: 'Invalid request origin.' })
      }
    }
    if (publishKey) {
      const supplied = Buffer.from(req.get('x-publish-key') || '')
      const expected = Buffer.from(publishKey)
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({ error: 'A valid publishing key is required.' })
    }
    const input = validateInput(req.body)
    if (!input) return res.status(400).json({ error: 'Complete all fields, select a topic, and use 1–5 tags of up to 30 characters.' })
    const post = {
      ...input, id: `post-${randomUUID()}`,
      initials: input.author.split(/\s+/).slice(0, 2).map((part) => part[0].toUpperCase()).join(''),
      date: new Date().toISOString().slice(0, 10),
      minutes: Math.max(1, Math.ceil(input.body.split(/\s+/).length / 200)),
      art: { Development: 'react', 'AI & ML': 'ai', 'Cloud & DevOps': 'docker', Design: 'css', Cybersecurity: 'security' }[input.category],
    }
    const write = writes.then(async () => {
      if (published.length >= 500) {
        const error = new Error('The blog has reached its 500-post storage limit.')
        error.status = 409
        throw error
      }
      const next = [post, ...published]
      await mkdir(dataDir, { recursive: true })
      await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2), { mode: 0o600 })
      await rename(`${file}.tmp`, file)
      published = next
    })
    writes = write.catch(() => {})
    await write
    res.status(201).json(post)
  })
  app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }))
  app.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-cache').type('html').send(renderHomePage(await template(), allPosts(), origin))
  })
  app.get('/articles/:id/', async (req, res) => {
    const post = allPosts().find((value) => value.id === req.params.id)
    if (!post) return res.status(404).type('html').send('<h1>Article not found</h1><a href="/">Back to Stacked</a>')
    res.set('Cache-Control', 'no-cache').type('html').send(renderArticlePage(await template(), post, origin))
  })
  app.get('/sitemap.xml', (req, res) => {
    if (!origin) return res.status(404).send('Set SITE_URL to enable the sitemap.')
    res.type('application/xml').send(renderSitemap(allPosts(), origin))
  })
  app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nAllow: /\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`))
  app.use(express.static(path.join(root, 'dist'), { index: false }))
  app.use((req, res) => res.status(404).type('html').send('<h1>Page not found</h1><a href="/">Back to Stacked</a>'))
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const status = error.status || 500
    const message = status === 413 ? 'Your article is too large. Please shorten it.'
      : status === 400 ? 'Invalid JSON request.'
        : status === 409 ? error.message : 'Unable to save or load this page. Please try again.'
    res.status(status).json({ error: message })
  })
  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const app = await createApp()
  const port = Number(process.env.PORT || 3000)
  app.listen(port, () => console.log(`Stacked is running at http://localhost:${port}`))
}
