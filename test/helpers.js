import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'

/**
 * Builds ZIP bytes with full control over header fields, for testing edge cases the
 * production writer never emits (legacy names, data descriptors, bad CRCs, ZIP64 markers).
 */
export function rawZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.isBuffer(entry.name) ? entry.name : Buffer.from(entry.name, 'utf8')
    const data = Buffer.from(entry.data ?? '')
    const method = entry.method ?? 8
    const body = entry.body ?? (method === 8 ? deflateRawSync(data) : data)
    const checksum = entry.crc ?? (crc32(data) >>> 0)
    const flags = (entry.flags ?? 0x0800) | (entry.descriptor ? 0x0008 : 0)
    const size = entry.size ?? data.length
    const compressedSize = entry.compressedSize ?? body.length

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(flags, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(entry.descriptor ? 0 : checksum, 14)
    local.writeUInt32LE(entry.descriptor ? 0 : compressedSize, 18)
    local.writeUInt32LE(entry.descriptor ? 0 : size, 22)
    local.writeUInt16LE(name.length, 26)
    const parts = [local, name, body]
    if (entry.descriptor) {
      const descriptor = Buffer.alloc(16)
      descriptor.writeUInt32LE(0x08074b50, 0)
      descriptor.writeUInt32LE(checksum, 4)
      descriptor.writeUInt32LE(compressedSize, 8)
      descriptor.writeUInt32LE(size, 12)
      parts.push(descriptor)
    }
    locals.push(...parts)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(flags, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(compressedSize, 20)
    central.writeUInt32LE(size, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(entry.offset ?? offset, 42)
    centrals.push(central, name)
    offset += parts.reduce((sum, part) => sum + part.length, 0)
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

export const manifest = (fields = {}) => JSON.stringify({ title: 'Sample demo', description: 'A sample.', tags: ['Test'], ...fields })

export async function tempDir() {
  return mkdtemp(path.join(tmpdir(), 'demo-catalog-'))
}

/** Writes `{ relativePath: content }` files under `root/id`. */
export async function writeDemo(root, id, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const destination = path.join(root, id, ...relativePath.split('/'))
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, content)
  }
}

export const cleanup = (directory) => rm(directory, { recursive: true, force: true })
