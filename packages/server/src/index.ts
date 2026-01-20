import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import 'dotenv/config'
import executionRoutes from './routes/execution'
import topicsRoutes from './routes/topics'
import questionsRoutes from './routes/questions'
import voiceRoutes from './routes/voice'
import { setupWebSocket } from './websocket'

const app = express()
const server = createServer(app)

// Set up WebSocket server for voice/interview
setupWebSocket(server)

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/topics', topicsRoutes)
app.use('/api/questions', questionsRoutes)
app.use('/api/execute', executionRoutes)
app.use('/api/voice', voiceRoutes)

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws/interview`)
})
