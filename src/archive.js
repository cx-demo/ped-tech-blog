import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib'

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const UTF8_FLAG = 0x0800
const MAX_COMMENT = 0xffff

// IBM code page 437, bytes 0x80-0xFF. Legacy ZIP tools store names in CP437 when the UTF-8 flag is not set.
const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0'

export class ArchiveError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ArchiveError'
    this.status = status
    this.expose = true
  }
}

function dosDateTime(date) {
  const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const year = Math.min(Math.max(value.getFullYear(), 1980), 2107)
  return {
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
  }
}

/** Creates a ZIP archive from `{ path, data, mtime? }` entries. Paths use forward slashes. */
export function createZip(entries) {
  if (entries.length > 0xfffe) throw new ArchiveError('Too many files for one archive.')
  const locals = []
  const centrals = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data)
    const checksum = crc32(data) >>> 0
    const deflated = deflateRawSync(data, { level: 9 })
    const useDeflate = deflated.length < data.length
    const body = useDeflate ? deflated : data
    const method = useDeflate ? 8 : 0
    const { time, date } = dosDateTime(entry.mtime)
    if (offset + 30 + name.length + body.length > 0xfffffffe) throw new ArchiveError('Archive is too large.')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL_HEADER, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(UTF8_FLAG, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, body)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(CENTRAL_HEADER, 0)
    central.writeUInt16LE((3 << 8) | 20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(UTF8_FLAG, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)

    offset += 30 + name.length + body.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

function decodeName(bytes, utf8Flag) {
  if (utf8Flag) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new ArchiveError('The archive contains a file name that is not valid UTF-8.')
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return Array.from(bytes, (byte) => byte < 0x80 ? String.fromCharCode(byte) : CP437[byte - 0x80]).join('')
  }
}

function findEndOfCentralDirectory(buffer) {
  const lowest = Math.max(0, buffer.length - 22 - MAX_COMMENT)
  for (let index = buffer.length - 22; index >= lowest; index -= 1) {
    if (buffer.readUInt32LE(index) === END_OF_CENTRAL_DIRECTORY && index + 22 + buffer.readUInt16LE(index + 20) <= buffer.length) return index
  }
  return -1
}

/**
 * Reads a ZIP buffer into `{ path, data }` file entries. Directory entries are omitted.
 * Rejects encrypted, ZIP64, multi-disk, malformed, and oversized archives.
 */
export function readZip(buffer, { maxEntries = 200, maxFileSize = 10 * 1024 * 1024, maxTotalSize = 50 * 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new ArchiveError('The file is not a valid ZIP archive.')
  const end = findEndOfCentralDirectory(buffer)
  if (end < 0) throw new ArchiveError('The file is not a valid ZIP archive.')
  const disk = buffer.readUInt16LE(end + 4)
  const centralDisk = buffer.readUInt16LE(end + 6)
  const diskEntries = buffer.readUInt16LE(end + 8)
  const totalEntries = buffer.readUInt16LE(end + 10)
  const centralSize = buffer.readUInt32LE(end + 12)
  const centralOffset = buffer.readUInt32LE(end + 16)
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new ArchiveError('ZIP64 archives are not supported. Create the archive with standard ZIP settings.')
  }
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) throw new ArchiveError('Split or multi-part ZIP archives are not supported.')
  if (centralOffset + centralSize > end) throw new ArchiveError('The ZIP archive is damaged (central directory out of range).')

  const files = []
  const names = new Set()
  const ranges = []
  let total = 0
  let pointer = centralOffset
  for (let index = 0; index < totalEntries; index += 1) {
    if (pointer + 46 > centralOffset + centralSize || buffer.readUInt32LE(pointer) !== CENTRAL_HEADER) {
      throw new ArchiveError('The ZIP archive is damaged (bad central directory entry).')
    }
    const flags = buffer.readUInt16LE(pointer + 8)
    const method = buffer.readUInt16LE(pointer + 10)
    const checksum = buffer.readUInt32LE(pointer + 16)
    const compressedSize = buffer.readUInt32LE(pointer + 20)
    const size = buffer.readUInt32LE(pointer + 24)
    const nameLength = buffer.readUInt16LE(pointer + 28)
    const extraLength = buffer.readUInt16LE(pointer + 30)
    const commentLength = buffer.readUInt16LE(pointer + 32)
    const localOffset = buffer.readUInt32LE(pointer + 42)
    const nameEnd = pointer + 46 + nameLength
    if (nameEnd > centralOffset + centralSize) throw new ArchiveError('The ZIP archive is damaged (bad file name).')
    const name = decodeName(buffer.subarray(pointer + 46, nameEnd), Boolean(flags & UTF8_FLAG)).replace(/\\/g, '/')
    pointer = nameEnd + extraLength + commentLength

    if (flags & 0x0001) throw new ArchiveError('Encrypted or password-protected ZIP archives are not supported.')
    if (compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) {
      throw new ArchiveError('ZIP64 archives are not supported. Create the archive with standard ZIP settings.')
    }
    if (name.endsWith('/')) {
      if (size !== 0) throw new ArchiveError('The ZIP archive is damaged (directory entry with content).')
      continue
    }
    if (method !== 0 && method !== 8) throw new ArchiveError(`"${name}" uses an unsupported compression method. Use standard ZIP (deflate) compression.`)
    if (files.length >= maxEntries) throw new ArchiveError(`The archive contains more than ${maxEntries} files.`)
    if (names.has(name)) throw new ArchiveError(`The archive contains "${name}" more than once.`)
    names.add(name)
    if (size > maxFileSize) throw new ArchiveError(`"${name}" is larger than the ${formatLimit(maxFileSize)} per-file limit.`)
    if (total + size > maxTotalSize) throw new ArchiveError(`The archive expands to more than the ${formatLimit(maxTotalSize)} limit.`)

    if (localOffset + 30 > centralOffset || buffer.readUInt32LE(localOffset) !== LOCAL_HEADER) {
      throw new ArchiveError('The ZIP archive is damaged (bad local file header).')
    }
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28)
    const dataEnd = dataStart + compressedSize
    if (dataEnd > centralOffset) throw new ArchiveError('The ZIP archive is damaged (file data out of range).')
    ranges.push([localOffset, dataEnd])

    const compressed = buffer.subarray(dataStart, dataEnd)
    let data
    if (method === 0) {
      if (compressedSize !== size) throw new ArchiveError(`"${name}" has inconsistent sizes.`)
      data = Buffer.from(compressed)
    } else {
      try {
        data = inflateRawSync(compressed, { maxOutputLength: Math.max(1, Math.min(maxFileSize, maxTotalSize - total)) })
      } catch (error) {
        if (error.code === 'ERR_BUFFER_TOO_LARGE') throw new ArchiveError(`"${name}" expands beyond the allowed size.`)
        throw new ArchiveError(`"${name}" could not be decompressed; the archive may be damaged.`)
      }
    }
    if (data.length !== size) throw new ArchiveError(`"${name}" has an incorrect size; the archive may be damaged.`)
    if ((crc32(data) >>> 0) !== checksum) throw new ArchiveError(`"${name}" failed its integrity check; the archive may be damaged.`)
    total += size
    files.push({ path: name, data })
  }

  ranges.sort((a, b) => a[0] - b[0])
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index][0] < ranges[index - 1][1]) throw new ArchiveError('The ZIP archive is damaged (overlapping entries).')
  }
  return files
}

function formatLimit(bytes) {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.round(bytes / 1024)} KB`
}
