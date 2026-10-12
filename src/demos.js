export const MAX_IMPORT_BYTES = 25 * 1024 * 1024

export const demoUrl = (id) => `/catalog/${encodeURIComponent(id)}/`
export const exportUrl = (id) => `/api/demos/${encodeURIComponent(id)}/export`
export const fileUrl = (id, filePath) => `/api/demos/${encodeURIComponent(id)}/files/${filePath.split('/').map(encodeURIComponent).join('/')}`

export function formatDate(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

const ART_RULES = [
  ['react', /react|next\.js|jsx/],
  ['ai', /\bai\b|machine learning|\bml\b|llm|copilot|agent/],
  ['docker', /docker|kubernetes|devops|container(?!.*quer)|cloud|azure|ci\/cd/],
  ['css', /css|html|design|ui|ux|responsive/],
  ['security', /security|auth|identity/],
]

/** Picks an artwork style for a demo card from its tags. */
export function artFor(tags) {
  const text = tags.join(' ').toLowerCase()
  return ART_RULES.find(([, pattern]) => pattern.test(text))?.[0] || 'javascript'
}

/** True when every whitespace-separated query term appears in the demo's title, description, tags, or author. */
export function matchesQuery(demo, query) {
  const haystack = `${demo.title} ${demo.description} ${demo.tags.join(' ')} ${demo.author || ''}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term))
}
