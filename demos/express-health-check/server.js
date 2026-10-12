import express from 'express'

const app = express()
let ready = false

app.get('/healthz', (req, res) => res.json({ status: 'ok' }))
app.get('/readyz', (req, res) => res.status(ready ? 200 : 503).json({ ready }))
app.get('/', (req, res) => res.json({ message: 'Hello from the health check demo' }))

const port = Number(process.env.PORT || 3000)
const server = app.listen(port, () => {
  ready = true
  console.log(`Listening on http://localhost:${port}`)
})

process.on('SIGTERM', () => {
  ready = false
  server.close(() => process.exit(0))
})
