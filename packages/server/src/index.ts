import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import 'dotenv/config'
import executionRoutes from './routes/execution'

import topicsRoutes from './routes/topics'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/topics', topicsRoutes)

// Execution routes
app.use('/api/execute', executionRoutes)

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected')

  ws.on('message', (message) => {
    console.log('Received:', message.toString())
  })

  ws.on('close', () => {
    console.log('WebSocket client disconnected')
  })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`)
})
