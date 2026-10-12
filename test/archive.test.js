import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'
import { deflateRawSync } from 'node:zlib'
import { ArchiveError, createZip, readZip } from '../src/archive.js'
import { cleanup, rawZip, tempDir } from './helpers.js'

const hasCommand = (command) => {
  try {
    execFileSync('which', [command], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('createZip and readZip', () => {
  it('round-trips text, binary, empty, nested, and Unicode entries', () => {
    const entries = [
      { path: 'demo.json', data: Buffer.from('{"title":"x"}') },
      { path: 'assets/image.bin', data: Buffer.from([0, 1, 2, 255, 254]) },
      { path: 'empty.txt', data: Buffer.alloc(0) },
      { path: 'docs/notes/ünïcødé.md', data: Buffer.from('# Hi\n'.repeat(200)) },
    ]
    const files = readZip(createZip(entries))
    assert.deepEqual(files.map((file) => file.path), entries.map((entry) => entry.path))
    for (const [index, file] of files.entries()) assert.ok(file.data.equals(entries[index].data))
  })

  it('reads stored entries, data descriptors, and directory entries', () => {
    const files = readZip(rawZip([
      { name: 'folder/', data: '', method: 0 },
      { name: 'stored.txt', data: 'plain', method: 0 },
      { name: 'streamed.txt', data: 'streamed content', descriptor: true },
    ]))
    assert.deepEqual(files.map((file) => [file.path, file.data.toString()]), [['stored.txt', 'plain'], ['streamed.txt', 'streamed content']])
  })

  it('normalizes backslashes and decodes legacy CP437 names', () => {
    const files = readZip(rawZip([
      { name: 'demo\\nested\\file.txt', data: 'a' },
      { name: Buffer.from([0x63, 0x61, 0x66, 0x82, 0x2e, 0x74, 0x78, 0x74]), data: 'b', flags: 0 },
    ]))
    assert.deepEqual(files.map((file) => file.path), ['demo/nested/file.txt', 'café.txt'])
  })

  it('rejects data that is not a ZIP archive', () => {
    assert.throws(() => readZip(Buffer.from('not a zip file at all, definitely not')), ArchiveError)
  })

  it('rejects encrypted entries', () => {
    assert.throws(() => readZip(rawZip([{ name: 'a.txt', data: 'x', flags: 0x0801 }])), /Encrypted/)
  })

  it('rejects ZIP64 markers', () => {
    assert.throws(() => readZip(rawZip([{ name: 'a.txt', data: 'x', size: 0xffffffff }])), /ZIP64/)
  })

  it('rejects unsupported compression methods', () => {
    assert.throws(() => readZip(rawZip([{ name: 'a.txt', data: 'x', method: 12, body: Buffer.from('x') }])), /unsupported compression/)
  })

  it('rejects CRC mismatches', () => {
    assert.throws(() => readZip(rawZip([{ name: 'a.txt', data: 'hello', crc: 1234 }])), /integrity check/)
  })

  it('rejects duplicate names', () => {
    assert.throws(() => readZip(rawZip([{ name: 'a.txt', data: '1' }, { name: 'a.txt', data: '2' }])), /more than once/)
  })

  it('rejects out-of-range offsets', () => {
    assert.throws(() => readZip(rawZip([{ name: 'a.txt', data: 'x', offset: 5000 }])), /damaged/)
  })

  it('stops decompression bombs that understate their size', () => {
    const bomb = Buffer.alloc(2 * 1024 * 1024)
    const archive = rawZip([{ name: 'bomb.txt', data: bomb, body: deflateRawSync(bomb), size: 1024 }])
    assert.throws(() => readZip(archive, { maxFileSize: 64 * 1024 }), /expands beyond|incorrect size/)
  })

  it('enforces declared per-file, total, and entry-count limits', () => {
    const archive = createZip([{ path: 'a.txt', data: Buffer.alloc(2000) }, { path: 'b.txt', data: Buffer.alloc(2000) }])
    assert.throws(() => readZip(archive, { maxFileSize: 1000 }), /per-file limit/)
    assert.throws(() => readZip(archive, { maxTotalSize: 3000 }), /expands to more than/)
    assert.throws(() => readZip(archive, { maxEntries: 1 }), /more than 1 files/)
  })

  it('reads archives created by the system zip tool', { skip: !hasCommand('zip') && 'zip command not available' }, async () => {
    const directory = await tempDir()
    try {
      await writeFile(path.join(directory, 'demo.json'), '{"title":"t"}')
      await writeFile(path.join(directory, 'big.txt'), 'abc'.repeat(10000))
      execFileSync('zip', ['-q', '-r', 'out.zip', 'demo.json', 'big.txt'], { cwd: directory })
      const files = readZip(await readFile(path.join(directory, 'out.zip')))
      assert.deepEqual(files.map((file) => file.path).sort(), ['big.txt', 'demo.json'])
      const streamed = execFileSync('sh', ['-c', 'zip -q - demo.json big.txt | cat'], { cwd: directory })
      assert.equal(readZip(streamed).length, 2)
    } finally {
      await cleanup(directory)
    }
  })

  it('produces archives the system unzip tool accepts', { skip: !hasCommand('unzip') && 'unzip command not available' }, async () => {
    const directory = await tempDir()
    try {
      await writeFile(path.join(directory, 'out.zip'), createZip([{ path: 'demo.json', data: Buffer.from('{}') }, { path: 'a/b.txt', data: Buffer.from('x'.repeat(500)) }]))
      const output = execFileSync('unzip', ['-t', 'out.zip'], { cwd: directory }).toString()
      assert.match(output, /No errors detected/)
    } finally {
      await cleanup(directory)
    }
  })
})
