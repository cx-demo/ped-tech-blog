import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createZip, readZip } from './archive.js'

const MB = 1024 * 1024

export const MANIFEST_FILE = 'demo.json'
export const SCHEMA_VERSION = 1

export const LIMITS = Object.freeze({
  archiveBytes: 25 * MB,
  files: 200,
  fileBytes: 10 * MB,
  demoBytes: 50 * MB,
  manifestBytes: 64 * 1024,
  readmeBytes: 512 * 1024,
  pathLength: 200,
  pathDepth: 10,
  demos: 500,
  catalogBytes: 500 * MB,
  idLength: 64,
  titleLength: 120,
  descriptionLength: 500,
  tags: 10,
  tagLength: 30,
  authorLength: 80,
})

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])
const SKIPPED_DIRECTORIES = new Set(['.git', '__MACOSX', 'node_modules'])
const TEMP_PREFIX = '.import-'
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const BACKUP_PREFIX = '.backup-'

export class CatalogError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'CatalogError'
    this.status = status
    this.expose = true
  }
}

export function isValidId(id) {
  return typeof id === 'string' && id.length <= LIMITS.idLength && ID_PATTERN.test(id)
}

export function slugify(text) {
  return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITS.idLength).replace(/-+$/, '')
}

/** True for a relative, forward-slash path with no traversal, absolute, or control-character segments. */
export function isSafePath(value) {
  if (typeof value !== 'string' || !value || value.length > LIMITS.pathLength) return false
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value) || value.startsWith('/') || /^[a-zA-Z]:/.test(value)) return false
  const segments = value.split('/')
  return segments.length <= LIMITS.pathDepth && segments.every((segment) => segment && segment !== '.' && segment !== '..')
}

export function isIgnoredPath(value) {
  const segments = value.split('/')
  return segments.some((segment) => SKIPPED_DIRECTORIES.has(segment)) || IGNORED_NAMES.has(segments.at(-1))
}

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)

function optionalString(value, field, max, errors) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    errors.push(`"${field}" must be a non-empty string of up to ${max} characters.`)
    return undefined
  }
  return value.trim()
}

/** Validates a parsed manifest. Returns `{ manifest, errors }`; `manifest` holds normalized known fields. */
export function validateManifest(value) {
  const errors = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { manifest: null, errors: ['The manifest must be a JSON object.'] }
  const schemaVersion = value.schemaVersion ?? SCHEMA_VERSION
  if (schemaVersion !== SCHEMA_VERSION) errors.push(`"schemaVersion" ${JSON.stringify(schemaVersion)} is not supported; this catalog supports ${SCHEMA_VERSION}.`)
  if (value.id !== undefined && !isValidId(value.id)) errors.push(`"id" must be lower-case letters, numbers, and single hyphens (up to ${LIMITS.idLength} characters).`)
  const title = optionalString(value.title, 'title', LIMITS.titleLength, errors)
  const description = optionalString(value.description, 'description', LIMITS.descriptionLength, errors)
  if (value.title === undefined) errors.push('"title" is required.')
  if (value.description === undefined) errors.push('"description" is required.')
  let tags = []
  if (!Array.isArray(value.tags) || !value.tags.length) {
    errors.push('"tags" must be a list with at least one search tag.')
  } else if (value.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > LIMITS.tagLength)) {
    errors.push(`Each tag must be a non-empty string of up to ${LIMITS.tagLength} characters.`)
  } else {
    const seen = new Set()
    tags = value.tags.map((tag) => tag.trim()).filter((tag) => !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()))
    if (tags.length > LIMITS.tags) errors.push(`Use at most ${LIMITS.tags} tags.`)
  }
  const author = optionalString(value.author, 'author', LIMITS.authorLength, errors)
  if (value.updated !== undefined && (typeof value.updated !== 'string' || !isDate(value.updated))) errors.push('"updated" must be a date in YYYY-MM-DD format.')
  if (value.readme !== undefined && !isSafePath(value.readme)) errors.push('"readme" must be a relative path inside the demo.')
  if (errors.length) return { manifest: null, errors }
  return {
    errors,
    manifest: {
      schemaVersion, id: value.id, title, description, tags, author,
      updated: value.updated, readme: value.readme ?? 'README.md',
    },
  }
}

/** Parses and validates `demo.json` bytes, throwing a `CatalogError` listing every problem. */
export function parseManifest(data) {
  if (data.length > LIMITS.manifestBytes) throw new CatalogError(`${MANIFEST_FILE} is larger than ${LIMITS.manifestBytes / 1024} KB.`)
  let raw
  try {
    raw = JSON.parse(data.toString('utf8').replace(/^\uFEFF/, ''))
  } catch {
    throw new CatalogError(`${MANIFEST_FILE} is not valid JSON.`)
  }
  const { manifest, errors } = validateManifest(raw)
  if (errors.length) throw new CatalogError(`${MANIFEST_FILE} is invalid: ${errors.join(' ')}`)
  return { raw, manifest }
}

/** Returns manifest JSON with `id` included, keeping every other field (including unknown ones). */
function manifestWithId(raw, id) {
  if (raw.id === id) return null
  const { $schema, schemaVersion, ...rest } = raw
  return `${JSON.stringify({ $schema, schemaVersion, id, ...rest }, null, 2)}\n`
}

async function listFiles(root) {
  const files = []
  async function walk(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) await walk(path.join(directory, entry.name), relative)
      } else if (entry.isFile() && !IGNORED_NAMES.has(entry.name)) {
        if (!isSafePath(relative)) throw new CatalogError(`"${relative}" has an unsupported file name.`)
        const info = await stat(path.join(directory, entry.name))
        files.push({ path: relative, size: info.size, mtime: info.mtime })
      }
    }
  }
  await walk(root, '')
  return files.sort((a, b) => byCodePoint(a.path, b.path))
}

async function readDemo(directory, id, readOnly) {
  const files = await listFiles(directory)
  const manifestFile = files.find((file) => file.path === MANIFEST_FILE)
  if (!manifestFile) throw new CatalogError(`missing ${MANIFEST_FILE}`)
  const { manifest } = parseManifest(await readFile(path.join(directory, MANIFEST_FILE)))
  if (manifest.id && manifest.id !== id) throw new CatalogError(`manifest id "${manifest.id}" does not match folder name "${id}"`)
  const size = files.reduce((sum, file) => sum + file.size, 0)
  if (files.length > LIMITS.files) throw new CatalogError(`more than ${LIMITS.files} files`)
  if (files.some((file) => file.size > LIMITS.fileBytes) || size > LIMITS.demoBytes) throw new CatalogError('exceeds archive size limits')
  const readme = files.some((file) => file.path === manifest.readme) ? manifest.readme : null
  if (!readme && manifest.readme !== 'README.md') throw new CatalogError(`readme "${manifest.readme}" not found`)
  const latest = files.reduce((value, file) => (file.mtime > value ? file.mtime : value), new Date(0))
  return {
    id, dir: directory, readOnly, readme,
    title: manifest.title, description: manifest.description, tags: manifest.tags,
    author: manifest.author ?? null,
    updated: manifest.updated ?? latest.toISOString().slice(0, 10),
    files: files.map(({ path: filePath, size: fileSize }) => ({ path: filePath, size: fileSize })),
    size,
  }
}

async function readDirectory(directory) {
  try {
    return await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

/**
 * Loads demos from the read-only bundled directory and the writable demos directory.
 * When both resolve to the same path, every demo is writable. Bundled demos win ID conflicts.
 */
export async function loadCatalog({ bundledDir, demosDir }) {
  const same = path.resolve(bundledDir) === path.resolve(demosDir)
  const sources = same ? [[demosDir, false]] : [[bundledDir, true], [demosDir, false]]
  const demos = new Map()
  const warnings = []
  for (const [directory, readOnly] of sources) {
    const entries = (await readDirectory(directory)).sort((a, b) => byCodePoint(a.name, b.name))
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      if (!isValidId(entry.name)) {
        warnings.push(`Skipped "${entry.name}": folder name is not a valid demo ID.`)
        continue
      }
      if (demos.has(entry.name)) {
        warnings.push(`Skipped "${entry.name}" in ${directory}: a demo with this ID is already loaded.`)
        continue
      }
      try {
        demos.set(entry.name, await readDemo(path.join(directory, entry.name), entry.name, readOnly))
      } catch (error) {
        warnings.push(`Skipped "${entry.name}": ${error.message}`)
      }
    }
  }
  return { demos: [...demos.values()].sort((a, b) => a.title.localeCompare(b.title)), warnings }
}

/**
 * Creates the writable demos directory, restores or removes leftovers from interrupted imports,
 * and reports whether the directory can be written.
 */
export async function prepareDemosDir(demosDir) {
  try {
    await mkdir(demosDir, { recursive: true })
    await access(demosDir, constants.W_OK)
  } catch {
    return false
  }
  for (const entry of await readDirectory(demosDir)) {
    if (!entry.isDirectory()) continue
    const leftover = path.join(demosDir, entry.name)
    if (entry.name.startsWith(BACKUP_PREFIX)) {
      const id = entry.name.slice(BACKUP_PREFIX.length).split('.')[0]
      const target = path.join(demosDir, id)
      const exists = await stat(target).then(() => true, () => false)
      if (!exists && isValidId(id)) await rename(leftover, target)
      else await rm(leftover, { recursive: true, force: true })
    } else if (entry.name.startsWith(TEMP_PREFIX)) {
      await rm(leftover, { recursive: true, force: true })
    }
  }
  return true
}

export function summarize(demo) {
  const { id, title, description, tags, author, updated, readOnly, size } = demo
  return { id, title, description, tags, author, updated, readOnly, size, fileCount: demo.files.length }
}

/** Reads a resource by its exact catalog path; returns `null` for unknown paths. */
export async function readDemoFile(demo, relativePath) {
  if (!demo.files.some((file) => file.path === relativePath)) return null
  return readFile(path.join(demo.dir, ...relativePath.split('/')))
}

export async function readReadme(demo) {
  if (!demo.readme) return null
  const data = await readDemoFile(demo, demo.readme)
  if (!data) return null
  const truncated = data.length > LIMITS.readmeBytes
  return { path: demo.readme, text: data.subarray(0, LIMITS.readmeBytes).toString('utf8'), truncated }
}

/** Builds the export archive: `demo.json` (always including `id`) at the root plus every resource. */
export async function exportDemo(demo) {
  const entries = []
  for (const file of demo.files) {
    let data = await readDemoFile(demo, file.path)
    if (file.path === MANIFEST_FILE) {
      const rewritten = manifestWithId(JSON.parse(data.toString('utf8').replace(/^\uFEFF/, '')), demo.id)
      if (rewritten) data = Buffer.from(rewritten)
    }
    const { mtime } = await stat(path.join(demo.dir, ...file.path.split('/')))
    entries.push({ path: file.path, data, mtime })
  }
  entries.sort((a, b) => (a.path === MANIFEST_FILE ? -1 : b.path === MANIFEST_FILE ? 1 : byCodePoint(a.path, b.path)))
  return createZip(entries)
}

function archiveRoot(entries) {
  if (entries.some((entry) => entry.path === MANIFEST_FILE)) return { prefix: '', wrapper: null }
  const tops = new Set(entries.map((entry) => entry.path.split('/')[0]))
  const [top] = tops
  if (tops.size === 1 && entries.some((entry) => entry.path === `${top}/${MANIFEST_FILE}`)) return { prefix: `${top}/`, wrapper: top }
  throw new CatalogError(`No ${MANIFEST_FILE} manifest was found at the top of the archive.`)
}

/**
 * Validates and extracts a demo archive into `demosDir/<id>` atomically.
 * Returns the demo ID. Callers must serialize imports.
 */
export async function importDemo(buffer, { demosDir, demos, replace = false }) {
  if (buffer.length > LIMITS.archiveBytes) throw new CatalogError(`The archive is larger than the ${LIMITS.archiveBytes / MB} MB import limit.`, 413)
  const entries = readZip(buffer, { maxEntries: LIMITS.files, maxFileSize: LIMITS.fileBytes, maxTotalSize: LIMITS.demoBytes })
    .filter((entry) => !isIgnoredPath(entry.path))
  if (!entries.length) throw new CatalogError('The archive is empty.')
  for (const entry of entries) {
    if (!isSafePath(entry.path)) throw new CatalogError(`The archive contains an unsafe file path: "${entry.path.slice(0, 120)}".`)
  }
  const { prefix, wrapper } = archiveRoot(entries)
  const files = entries.map((entry) => ({ path: entry.path.slice(prefix.length), data: entry.data }))

  const lowerPaths = new Set()
  for (const file of files) {
    const lower = file.path.toLowerCase()
    if (lowerPaths.has(lower)) throw new CatalogError(`The archive contains files whose names differ only by letter case: "${file.path}".`)
    lowerPaths.add(lower)
  }
  for (const file of files) {
    const segments = file.path.toLowerCase().split('/')
    for (let depth = 1; depth < segments.length; depth += 1) {
      if (lowerPaths.has(segments.slice(0, depth).join('/'))) throw new CatalogError(`"${file.path}" conflicts with a file of the same name as its folder.`)
    }
  }

  const manifestEntry = files.find((file) => file.path === MANIFEST_FILE)
  const { raw, manifest } = parseManifest(manifestEntry.data)
  const id = manifest.id || (wrapper && isValidId(wrapper) ? wrapper : slugify(manifest.title))
  if (!isValidId(id)) throw new CatalogError(`A demo ID could not be derived from the title. Add an "id" to ${MANIFEST_FILE}.`)
  if (raw.readme !== undefined && !files.some((file) => file.path === manifest.readme)) {
    throw new CatalogError(`The readme "${manifest.readme}" named in ${MANIFEST_FILE} is not in the archive.`)
  }

  const existing = demos.find((demo) => demo.id === id)
  if (existing?.readOnly) throw new CatalogError(`"${id}" is a built-in demo and cannot be replaced. Change the "id" in ${MANIFEST_FILE} to import a copy.`, 409)
  if (existing && !replace) throw new CatalogError(`A demo with the ID "${id}" already exists. Select "Replace an existing demo with the same ID" to overwrite it.`, 409)
  if (!existing && demos.length >= LIMITS.demos) throw new CatalogError(`The catalog has reached its ${LIMITS.demos}-demo limit.`, 507)
  const size = files.reduce((sum, file) => sum + file.data.length, 0)
  const stored = demos.filter((demo) => !demo.readOnly && demo.id !== id).reduce((sum, demo) => sum + demo.size, 0)
  if (stored + size > LIMITS.catalogBytes) throw new CatalogError('The catalog storage limit has been reached. Remove a demo before importing another.', 507)

  const rewritten = manifestWithId(raw, id)
  const temporary = path.join(demosDir, `${TEMP_PREFIX}${randomUUID()}`)
  const target = path.join(demosDir, id)
  try {
    for (const file of files) {
      const destination = path.join(temporary, ...file.path.split('/'))
      await mkdir(path.dirname(destination), { recursive: true })
      await writeFile(destination, file.path === MANIFEST_FILE && rewritten ? rewritten : file.data, { mode: 0o644 })
    }
    if (existing) {
      const backup = path.join(demosDir, `${BACKUP_PREFIX}${id}.${randomUUID()}`)
      await rename(target, backup)
      try {
        await rename(temporary, target)
      } catch (error) {
        await rename(backup, target)
        throw error
      }
      await rm(backup, { recursive: true, force: true })
    } else {
      try {
        await rename(temporary, target)
      } catch (error) {
        if (['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) {
          throw new CatalogError(`A folder named "${id}" already exists in the demo directory but is not a valid demo.`, 409)
        }
        throw error
      }
    }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
  return id
}
