import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createZip, readZip } from '../src/archive.js'
import { cleanup, manifest, tempDir, writeDemo } from './helpers.js'

process.env.NODE_ENV = 'test'
const { createApp } = await import('../server.js')

const TEMPLATE = '<!doctype html><html><head><title>Stacked</title><meta name="description" content="x" /><meta name="keywords" content="x" /><meta property="og:type" content="website" /></head><body><div id="root"></div></body></html>'
const zip = (files) => createZip(Object.entries(files).map(([filePath, data]) => ({ path: filePath, data: Buffer.from(data) })))

async function start(options) {
  const app = await createApp({ template: TEMPLATE, siteUrl: 'https://demos.example', ...options })
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)) })
  const base = `http://127.0.0.1:${server.address().port}`
  return { base, close: () => new Promise((resolve) => server.close(resolve)) }
}

describe('demo catalog server', () => {
  let root
  let bundledDir
  let demosDir
  let server

  before(async () => {
    root = await tempDir()
    bundledDir = path.join(root, 'bundled')
    demosDir = path.join(root, 'data', 'demos')
    await writeDemo(bundledDir, 'builtin', {
      'demo.json': manifest({ title: 'Built <in>', tags: ['CSS', 'HTML'], author: 'Team' }),
      'README.md': '# Built in\n\nRun `npm start`.\n\n<script>alert(1)</script>',
      'site/index.html': '<script>alert(1)</script>',
    })
    server = await start({ bundledDir, demosDir, publishKey: 'secret-key' })
  })
  after(async () => {
    await server.close()
    await cleanup(root)
  })

  const upload = (body, { key = 'secret-key', type = 'application/zip', query = '', origin } = {}) => fetch(`${server.base}/api/demos/import${query}`, {
    method: 'POST', body, headers: { 'Content-Type': type, ...(key ? { 'X-Publish-Key': key } : {}), ...(origin ? { Origin: origin } : {}) },
  })

  it('lists demos with summaries', async () => {
    const response = await fetch(`${server.base}/api/demos`)
    const data = await response.json()
    assert.equal(response.status, 200)
    assert.equal(data.requiresKey, true)
    assert.equal(data.canImport, true)
    assert.deepEqual(data.demos.map((demo) => [demo.id, demo.readOnly, demo.fileCount]), [['builtin', true, 3]])
    assert.deepEqual(data.demos[0].tags, ['CSS', 'HTML'])
  })

  it('returns demo detail with README and files', async () => {
    const data = await (await fetch(`${server.base}/api/demos/builtin`)).json()
    assert.equal(data.readme.path, 'README.md')
    assert.deepEqual(data.files.map((file) => file.path), ['README.md', 'demo.json', 'site/index.html'])
    assert.equal((await fetch(`${server.base}/api/demos/missing`)).status, 404)
  })

  it('serves resource files as sandboxed attachments only', async () => {
    const response = await fetch(`${server.base}/api/demos/builtin/files/site/index.html`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/octet-stream')
    assert.match(response.headers.get('content-disposition'), /^attachment; filename="index.html"/)
    assert.match(response.headers.get('content-security-policy'), /sandbox/)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(await response.text(), '<script>alert(1)</script>')
    assert.equal((await fetch(`${server.base}/api/demos/builtin/files/..%2Fbuiltin%2Fdemo.json`)).status, 404)
    assert.equal((await fetch(`${server.base}/api/demos/builtin/files/nope.txt`)).status, 404)
  })

  it('exports a ZIP with the manifest (including id) and every resource', async () => {
    const response = await fetch(`${server.base}/api/demos/builtin/export`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/zip')
    assert.match(response.headers.get('content-disposition'), /filename="builtin.zip"/)
    const entries = readZip(Buffer.from(await response.arrayBuffer()))
    assert.deepEqual(entries.map((entry) => entry.path), ['demo.json', 'README.md', 'site/index.html'])
    assert.equal(JSON.parse(entries[0].data).id, 'builtin')
  })

  it('imports a ZIP, then lists and serves the new demo', async () => {
    const response = await upload(zip({ 'demo.json': manifest({ id: 'imported-one', title: 'Imported one', tags: ['Node.js'] }), 'index.js': 'console.log(1)' }))
    assert.equal(response.status, 201)
    const created = await response.json()
    assert.equal(created.id, 'imported-one')
    assert.equal(created.readOnly, false)
    assert.deepEqual(await readdir(demosDir), ['imported-one'])
    const list = await (await fetch(`${server.base}/api/demos`)).json()
    assert.deepEqual(list.demos.map((demo) => demo.id), ['builtin', 'imported-one'])
    assert.equal(await (await fetch(`${server.base}/api/demos/imported-one/files/index.js`)).text(), 'console.log(1)')
  })

  it('round-trips an exported archive and enforces conflict and replace rules', async () => {
    const exported = Buffer.from(await (await fetch(`${server.base}/api/demos/imported-one/export`)).arrayBuffer())
    const conflict = await upload(exported)
    assert.equal(conflict.status, 409)
    assert.match((await conflict.json()).error, /already exists/)
    assert.equal((await upload(exported, { query: '?replace=1' })).status, 201)
    const builtin = Buffer.from(await (await fetch(`${server.base}/api/demos/builtin/export`)).arrayBuffer())
    const refused = await upload(builtin, { query: '?replace=1' })
    assert.equal(refused.status, 409)
    assert.match((await refused.json()).error, /built-in demo/)
  })

  it('requires the publishing key and same origin', async () => {
    const archive = zip({ 'demo.json': manifest({ id: 'blocked' }) })
    const unauthorized = await upload(archive, { key: 'wrong' })
    assert.equal(unauthorized.status, 401)
    assert.equal((await unauthorized.json()).error, 'A valid publishing key is required.')
    const crossOrigin = await upload(archive, { origin: 'https://evil.example' })
    assert.equal(crossOrigin.status, 403)
    assert.equal((await crossOrigin.json()).error, 'Import from this site, not another origin.')
    assert.equal((await upload(archive, { origin: server.base })).status, 201)
  })

  it('reports clear errors for bad uploads', async () => {
    const wrongType = await upload('{}', { type: 'application/json' })
    assert.equal(wrongType.status, 415)
    assert.equal((await wrongType.json()).error, 'Upload a .zip archive.')
    const empty = await fetch(`${server.base}/api/demos/import`, { method: 'POST', headers: { 'X-Publish-Key': 'secret-key' } })
    assert.equal(empty.status, 400)
    assert.equal((await empty.json()).error, 'Choose a .zip archive to import.')
    const notZip = await upload(Buffer.from('definitely not a zip archive'))
    assert.equal(notZip.status, 400)
    assert.equal((await notZip.json()).error, 'The file is not a valid ZIP archive.')
    const badManifest = await upload(zip({ 'demo.json': '{"title":"x"}' }))
    assert.equal(badManifest.status, 400)
    assert.match((await badManifest.json()).error, /"description" is required/)
    const tooLarge = await upload(Buffer.alloc(25 * 1024 * 1024 + 10))
    assert.equal(tooLarge.status, 413)
    assert.equal((await tooLarge.json()).error, 'The archive is larger than the 25 MB import limit.')
  })

  it('server-renders the catalog, demo pages, sitemap, and legacy redirects', async () => {
    const home = await (await fetch(`${server.base}/`)).text()
    assert.match(home, /<a href="\/catalog\/builtin\/">Built &lt;in&gt;<\/a>/)
    const page = await (await fetch(`${server.base}/catalog/builtin/`)).text()
    assert.match(page, /<title>Built &lt;in&gt; — Stacked demos<\/title>/)
    assert.match(page, /<code>npm start<\/code>/)
    assert.ok(!page.includes('<script>alert(1)</script>'))
    assert.match(page, /SoftwareSourceCode/)
    assert.equal((await fetch(`${server.base}/catalog/missing/`)).status, 404)
    assert.match(await (await fetch(`${server.base}/sitemap.xml`)).text(), /https:\/\/demos.example\/catalog\/builtin\//)
    const legacy = await fetch(`${server.base}/articles/old-post/`, { redirect: 'manual' })
    assert.equal(legacy.status, 301)
    assert.equal((await fetch(`${server.base}/api/posts`)).status, 404)
  })
})

describe('demo catalog server without a writable directory', () => {
  it('disables imports but still serves bundled demos', { skip: process.getuid?.() === 0 && 'root ignores permissions' }, async () => {
    const root = await tempDir()
    try {
      const bundledDir = path.join(root, 'bundled')
      await writeDemo(bundledDir, 'only', { 'demo.json': manifest() })
      const { chmod } = await import('node:fs/promises')
      await chmod(root, 0o555)
      const server = await start({ bundledDir, demosDir: path.join(root, 'cannot-create'), publishKey: '' })
      try {
        const list = await (await fetch(`${server.base}/api/demos`)).json()
        assert.equal(list.canImport, false)
        assert.deepEqual(list.demos.map((demo) => demo.id), ['only'])
        const response = await fetch(`${server.base}/api/demos/import`, { method: 'POST', body: zip({ 'demo.json': manifest() }), headers: { 'Content-Type': 'application/zip' } })
        assert.equal(response.status, 503)
      } finally {
        await server.close()
        await chmod(root, 0o755)
      }
    } finally {
      await cleanup(root)
    }
  })
})
