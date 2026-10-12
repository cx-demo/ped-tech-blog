const RETRYABLE = new Set([408, 429, 500, 502, 503, 504])

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchWithRetry(url, options = {}, { retries = 3, baseDelay = 250, timeout = 5000 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) })
      if (!RETRYABLE.has(response.status) || attempt >= retries) return response
    } catch (error) {
      if (attempt >= retries) throw error
    }
    const delay = baseDelay * 2 ** attempt
    await wait(delay / 2 + Math.random() * (delay / 2))
  }
}
