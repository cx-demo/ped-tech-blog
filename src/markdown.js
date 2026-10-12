const FENCE = /^(`{3,}|~{3,})\s*([\w+#.-]*)$/
const HEADING_START = /^\s{0,3}(#{1,6})\s/
const isSpace = (character) => /\s/.test(character)

// Patterns avoid adjacent overlapping quantifiers so every line parses in linear time.
function parseFence(line) {
  const match = line.trim().match(FENCE)
  return match && { marker: match[1], lang: match[2] }
}

function parseHeading(line) {
  const match = line.match(HEADING_START)
  if (!match) return null
  let start = match[0].length
  while (start < line.length && isSpace(line[start])) start += 1
  const text = line.slice(start).trimEnd()
  let hashes = text.length
  while (hashes > 0 && text[hashes - 1] === '#') hashes -= 1
  if (hashes < text.length && hashes > 0 && isSpace(text[hashes - 1])) {
    return { level: match[1].length, text: text.slice(0, hashes).trimEnd() }
  }
  return { level: match[1].length, text }
}

/**
 * Minimal, safe Markdown subset for demo READMEs. Produces plain data blocks so callers
 * render text through React or HTML escaping; raw HTML in the source is never interpreted.
 */
export function parseMarkdown(source = '') {
  const lines = String(source).replace(/\r\n?|[\u2028\u2029]/g, '\n').split('\n')
  const blocks = []
  let paragraph = []
  let list = null

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    if (list) blocks.push(list)
    paragraph = []
    list = null
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fence = parseFence(line)
    if (fence) {
      flush()
      const code = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith(fence.marker)) {
        code.push(lines[index])
        index += 1
      }
      blocks.push({ type: 'code', lang: fence.lang, text: code.join('\n') })
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    const heading = parseHeading(line)
    if (heading) {
      flush()
      blocks.push({ type: 'heading', level: Math.min(heading.level, 3), text: heading.text })
      continue
    }
    const item = line.match(/^\s{0,3}([-*+]|\d{1,9}[.)])\s+(.*)$/)
    if (item) {
      const ordered = /\d/.test(item[1])
      if (paragraph.length || (list && list.ordered !== ordered)) flush()
      if (!list) list = { type: 'list', ordered, items: [] }
      list.items.push(item[2].trim())
      continue
    }
    if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`
      continue
    }
    if (list) flush()
    paragraph.push(line.trim())
  }
  flush()
  return blocks
}

/** Splits text into plain and inline-code segments delimited by backticks. */
export function splitInline(text = '') {
  return String(text).split(/(`[^`]+`)/).filter(Boolean).map((part) => (
    part.length > 2 && part.startsWith('`') && part.endsWith('`')
      ? { code: true, text: part.slice(1, -1) }
      : { code: false, text: part }
  ))
}
