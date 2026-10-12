import { fetchWithRetry } from './retry.js'

const response = await fetchWithRetry('https://httpbin.org/status/503,200', {}, { retries: 4, baseDelay: 200 })
console.log(`Final status: ${response.status}`)
