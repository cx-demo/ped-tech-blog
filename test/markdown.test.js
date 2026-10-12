import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseMarkdown, splitInline } from '../src/markdown.js'
import { renderMarkdownHtml } from '../src/seo.js'

// Previous implementation's patterns, kept only to prove the linear-time parser is equivalent.
const OLD_FENCE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/
const OLD_HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/

describe('parseMarkdown', () => {
  it('parses headings, paragraphs, lists, and fenced code', () => {
    const blocks = parseMarkdown('# Title\n\nFirst line\nsecond line\n\n- one\n- two\n  continued\n\n1. first\n2. second\n\n```sh\nnpm start\n<b>raw</b>\n```\n#### Deep')
    assert.deepEqual(blocks, [
      { type: 'heading', level: 1, text: 'Title' },
      { type: 'paragraph', text: 'First line second line' },
      { type: 'list', ordered: false, items: ['one', 'two continued'] },
      { type: 'list', ordered: true, items: ['first', 'second'] },
      { type: 'code', lang: 'sh', text: 'npm start\n<b>raw</b>' },
      { type: 'heading', level: 3, text: 'Deep' },
    ])
  })

  it('handles an unterminated fence and CRLF input', () => {
    assert.deepEqual(parseMarkdown('Intro\r\n```\r\ncode'), [
      { type: 'paragraph', text: 'Intro' },
      { type: 'code', lang: '', text: 'code' },
    ])
  })

  it('treats Unicode line and paragraph separators as line breaks', () => {
    assert.deepEqual(parseMarkdown('# A\u2028- b\u2029c'), [
      { type: 'heading', level: 1, text: 'A' },
      { type: 'list', ordered: false, items: ['b'] },
      { type: 'paragraph', text: 'c' },
    ])
  })

  it('classifies fence and heading lines exactly like the previous patterns', () => {
    const lines = [
      '# Title', '#\tTabbed', '#\u00a0Nbsp title', '\u00a0 # Indented', '   ### Three', '    # Four spaces', '#x', '# ', '#   ', '#  #', '# #',
      '# a # #', '## Title ##', '## Title ##  ', '# Title#', '####### x', '###### six', '# a \t##\t', '#\u00a0#',
      '```', '```sh', '``` sh', ' ```js  ', '```sh x', '~~~', '~~~ python', '````js', '``~~', '```c++', '```~', '\t```\t',
    ]
    for (const line of lines) {
      const fence = line.match(OLD_FENCE)
      const heading = line.match(OLD_HEADING)
      const [block] = parseMarkdown(line)
      if (fence) assert.deepEqual(block, { type: 'code', lang: fence[2], text: '' }, JSON.stringify(line))
      else if (heading) assert.deepEqual(block, { type: 'heading', level: Math.min(heading[1].length, 3), text: heading[2] }, JSON.stringify(line))
      else assert.notEqual(block?.type, 'heading', JSON.stringify(line))
    }
  })

  it('parses pathological long lines in linear time', { timeout: 10000 }, () => {
    const padding = ' '.repeat(500000)
    const cases = {
      fence: `\`\`\`${padding}!`,
      heading: `# x${padding}a`,
      closingHashes: `#${padding}#${padding}x`,
      listWithSeparator: `- ${padding}a\u2028`,
    }
    for (const [name, line] of Object.entries(cases)) {
      const started = performance.now()
      parseMarkdown(line)
      assert.ok(performance.now() - started < 500, `${name} took too long`)
    }
    const started = performance.now()
    renderMarkdownHtml(cases.fence)
    assert.ok(performance.now() - started < 500, 'renderMarkdownHtml took too long')
  })
})

describe('splitInline', () => {
  it('separates inline code spans', () => {
    assert.deepEqual(splitInline('Run `npm test` now'), [
      { code: false, text: 'Run ' }, { code: true, text: 'npm test' }, { code: false, text: ' now' },
    ])
  })
})
