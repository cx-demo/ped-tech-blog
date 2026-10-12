import assert from 'node:assert/strict'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createZip, readZip } from '../src/archive.js'
import {
  exportDemo, importDemo, isSafePath, loadCatalog, prepareDemosDir, readDemoFile, readReadme, slugify, validateManifest,
} from '../src/catalog.js'
import { cleanup, manifest, rawZip, tempDir, writeDemo } from './helpers.js'

const zip = (files) => createZip(Object.entries(files).map(([filePath, data]) => ({ path: filePath, data: Buffer.from(data) })))

describe('validateManifest', () => {
  it('accepts a minimal manifest and applies defaults', () => {
    const { manifest: value, errors } = validateManifest({ title: ' Demo ', description: 'Desc', tags: ['CSS', 'css', 'HTML'] })
    assert.deepEqual(errors, [])
    assert.equal(value.title, 'Demo')
    assert.deepEqual(value.tags, ['CSS', 'HTML'])
    assert.equal(value.readme, 'README.md')
    assert.equal(value.schemaVersion, 1)
  })

  it('reports every problem', () => {
    const { errors } = validateManifest({ schemaVersion: 2, id: 'Bad ID', tags: [], updated: '2026-02-30', readme: '../x.md' })
    assert.equal(errors.length, 7)
  })

  it('rejects non-objects and over-long tags', () => {
    assert.ok(validateManifest([]).errors.length)
    assert.ok(validateManifest({ title: 't', description: 'd', tags: ['x'.repeat(31)] }).errors.length)
    assert.ok(validateManifest({ title: 't', description: 'd', tags: Array.from({ length: 11 }, (_, index) => `t${index}`) }).errors.length)
  })
})

describe('paths and IDs', () => {
  it('accepts only safe relative paths', () => {
    for (const value of ['a.txt', 'dir/b.txt', '.env.example']) assert.ok(isSafePath(value), value)
    for (const value of ['', '/abs', '../x', 'a/../b', 'a//b', 'C:/x', 'a\\b', 'a/./b', 'bad\u0000name', 'x/'.repeat(11) + 'y']) assert.ok(!isSafePath(value), value)
  })

  it('slugifies titles', () => {
    assert.equal(slugify('  Héllo, World! 2026 '), 'hello-world-2026')
  })
})

describe('loadCatalog', () => {
  let root
  before(async () => {
    root = await tempDir()
    await writeDemo(path.join(root, 'bundled'), 'alpha', { 'demo.json': manifest({ title: 'Alpha', id: 'alpha' }), 'README.md': '# A', 'src/app.js': 'x' })
    await writeDemo(path.join(root, 'bundled'), 'shared', { 'demo.json': manifest({ title: 'Bundled shared' }) })
    await writeDemo(path.join(root, 'bundled'), 'Bad_Name', { 'demo.json': manifest() })
    await writeDemo(path.join(root, 'bundled'), 'mismatch', { 'demo.json': manifest({ id: 'other' }) })
    await writeDemo(path.join(root, 'bundled'), 'invalid', { 'demo.json': '{"title":1}' })
    await writeDemo(path.join(root, 'bundled'), 'no-manifest', { 'README.md': 'x' })
    await writeDemo(path.join(root, 'writable'), 'shared', { 'demo.json': manifest({ title: 'Writable shared' }) })
    await writeDemo(path.join(root, 'writable'), 'beta', { 'demo.json': manifest({ title: 'Beta', updated: '2025-01-02' }), '.DS_Store': 'x' })
    await writeFile(path.join(root, 'bundled', 'demo.schema.json'), '{}')
  })
  after(() => cleanup(root))

  it('merges directories, skips invalid demos, and lets bundled demos win', async () => {
    const { demos, warnings } = await loadCatalog({ bundledDir: path.join(root, 'bundled'), demosDir: path.join(root, 'writable') })
    assert.deepEqual(demos.map((demo) => [demo.id, demo.readOnly]), [['alpha', true], ['beta', false], ['shared', true]])
    assert.equal(demos.find((demo) => demo.id === 'shared').title, 'Bundled shared')
    assert.equal(warnings.length, 5)
    const alpha = demos.find((demo) => demo.id === 'alpha')
    assert.deepEqual(alpha.files.map((file) => file.path), ['README.md', 'demo.json', 'src/app.js'])
    assert.equal(alpha.readme, 'README.md')
    assert.deepEqual(demos.find((demo) => demo.id === 'beta').files.map((file) => file.path), ['demo.json'])
  })

  it('treats a shared directory as writable', async () => {
    const { demos } = await loadCatalog({ bundledDir: path.join(root, 'writable'), demosDir: path.join(root, 'writable') + path.sep })
    assert.ok(demos.every((demo) => !demo.readOnly))
  })

  it('returns an empty catalog for a missing directory', async () => {
    const { demos } = await loadCatalog({ bundledDir: path.join(root, 'missing'), demosDir: path.join(root, 'missing') })
    assert.deepEqual(demos, [])
  })

  it('reads catalog files and READMEs but not unknown paths', async () => {
    const { demos } = await loadCatalog({ bundledDir: path.join(root, 'bundled'), demosDir: path.join(root, 'bundled') })
    const alpha = demos.find((demo) => demo.id === 'alpha')
    assert.equal((await readDemoFile(alpha, 'src/app.js')).toString(), 'x')
    assert.equal(await readDemoFile(alpha, '../shared/demo.json'), null)
    assert.deepEqual(await readReadme(alpha), { path: 'README.md', text: '# A', truncated: false })
  })
})

describe('exportDemo and importDemo', () => {
  let root
  before(async () => { root = await tempDir() })
  after(() => cleanup(root))

  const fresh = async (name) => {
    const directory = path.join(root, name)
    await mkdir(directory, { recursive: true })
    return directory
  }

  it('round-trips a demo without an id in its manifest to the same ID', async () => {
    const source = await fresh('source')
    await writeDemo(source, 'my-demo', { 'demo.json': manifest({ title: 'Totally different title', custom: { keep: true } }), 'README.md': '# Hi', 'lib/x.js': 'y' })
    const { demos } = await loadCatalog({ bundledDir: source, demosDir: source })
    const archive = await exportDemo(demos[0])
    const entries = readZip(archive)
    assert.equal(entries[0].path, 'demo.json')
    const exported = JSON.parse(entries[0].data.toString())
    assert.equal(exported.id, 'my-demo')
    assert.deepEqual(exported.custom, { keep: true })

    const target = await fresh('target')
    assert.equal(await importDemo(archive, { demosDir: target, demos: [] }), 'my-demo')
    const imported = await loadCatalog({ bundledDir: target, demosDir: target })
    assert.deepEqual(imported.demos[0].files.map((file) => file.path), ['README.md', 'demo.json', 'lib/x.js'])
    assert.equal(JSON.parse(await readFile(path.join(target, 'my-demo', 'demo.json'), 'utf8')).id, 'my-demo')
  })

  it('strips a single wrapper folder and uses its name as the ID', async () => {
    const target = await fresh('wrapper')
    const archive = zip({ 'cool-demo/demo.json': manifest({ title: 'Some title' }), 'cool-demo/a.txt': 'a', '__MACOSX/cool-demo/._a.txt': 'junk', 'cool-demo/.DS_Store': 'junk' })
    assert.equal(await importDemo(archive, { demosDir: target, demos: [] }), 'cool-demo')
    assert.deepEqual((await readdir(path.join(target, 'cool-demo'))).sort(), ['a.txt', 'demo.json'])
  })

  it('derives the ID from the title when nothing else is available', async () => {
    const target = await fresh('title')
    assert.equal(await importDemo(zip({ 'demo.json': manifest({ title: 'Hello World!' }) }), { demosDir: target, demos: [] }), 'hello-world')
  })

  it('rejects traversal, absolute, and Windows-style escape paths', async () => {
    const target = await fresh('unsafe')
    for (const name of ['../evil.txt', '/etc/evil', 'a/../../evil', '..\\evil.txt', 'C:\\evil.txt']) {
      const archive = rawZip([{ name: 'demo.json', data: manifest() }, { name, data: 'x' }])
      await assert.rejects(importDemo(archive, { demosDir: target, demos: [] }), /unsafe file path/, name)
    }
    assert.deepEqual(await readdir(target), [])
  })

  it('rejects archives without a manifest, invalid manifests, and case collisions', async () => {
    const target = await fresh('invalid')
    await assert.rejects(importDemo(zip({ 'a/demo.json': manifest(), 'b/x.txt': 'x' }), { demosDir: target, demos: [] }), /No demo.json/)
    await assert.rejects(importDemo(zip({ 'demo.json': '{"title":"x"}' }), { demosDir: target, demos: [] }), /"description" is required/)
    await assert.rejects(importDemo(zip({ 'demo.json': 'not json' }), { demosDir: target, demos: [] }), /not valid JSON/)
    await assert.rejects(importDemo(zip({ 'demo.json': manifest({ readme: 'docs/x.md' }) }), { demosDir: target, demos: [] }), /readme/)
    await assert.rejects(importDemo(zip({ 'demo.json': manifest(), 'A.txt': '1', 'a.txt': '2' }), { demosDir: target, demos: [] }), /letter case/)
    await assert.rejects(importDemo(zip({ 'demo.json': manifest(), x: '1', 'x/y': '2' }), { demosDir: target, demos: [] }), /conflicts/)
    await assert.rejects(importDemo(zip({ 'demo.json': manifest({ title: '!!!' }) }), { demosDir: target, demos: [] }), /could not be derived/)
    assert.deepEqual(await readdir(target), [])
  })

  it('requires replace for conflicts and never replaces read-only demos', async () => {
    const target = await fresh('conflict')
    const archive = zip({ 'demo.json': manifest({ id: 'dup', title: 'v1' }) })
    await importDemo(archive, { demosDir: target, demos: [] })
    let { demos } = await loadCatalog({ bundledDir: target, demosDir: target })
    await assert.rejects(importDemo(archive, { demosDir: target, demos }), (error) => error.status === 409 && /already exists/.test(error.message))
    await importDemo(zip({ 'demo.json': manifest({ id: 'dup', title: 'v2' }), 'new.txt': 'n' }), { demosDir: target, demos, replace: true });
    ({ demos } = await loadCatalog({ bundledDir: target, demosDir: target }))
    assert.equal(demos[0].title, 'v2')
    assert.deepEqual(await readdir(target), ['dup'])
    const readOnly = demos.map((demo) => ({ ...demo, readOnly: true }))
    await assert.rejects(importDemo(archive, { demosDir: target, demos: readOnly, replace: true }), /built-in demo/)
  })

  it('rejects oversized uploads before parsing', async () => {
    const target = await fresh('large')
    await assert.rejects(importDemo(Buffer.alloc(25 * 1024 * 1024 + 1), { demosDir: target, demos: [] }), (error) => error.status === 413)
  })
})

describe('prepareDemosDir', () => {
  it('creates the directory, restores interrupted replacements, and removes temp folders', async () => {
    const root = await tempDir()
    try {
      const directory = path.join(root, 'nested', 'demos')
      assert.equal(await prepareDemosDir(directory), true)
      await writeDemo(directory, '.import-123', { 'a.txt': 'x' })
      await writeDemo(directory, '.backup-orphan.abc', { 'demo.json': manifest() })
      await writeDemo(directory, 'kept', { 'demo.json': manifest() })
      await writeDemo(directory, '.backup-kept.def', { 'demo.json': manifest() })
      assert.equal(await prepareDemosDir(directory), true)
      assert.deepEqual((await readdir(directory)).sort(), ['kept', 'orphan'])
    } finally {
      await cleanup(root)
    }
  })
})
