import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { createConnection } from 'net'
import 'dotenv/config'
import executionRoutes from './routes/execution'
import topicsRoutes from './routes/topics'
import questionsRoutes from './routes/questions'
import voiceRoutes from './routes/voice'
import { setupWebSocket } from './websocket'

const DEFAULT_PORT = parseInt(process.env.PORT || '3001', 10)
const MAX_PORT_ATTEMPTS = 10

// Check if a port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    socket.setTimeout(200)
    socket.on('connect', () => {
      socket.destroy()
      resolve(false) // Port is in use
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(true) // Port is available
    })
    socket.on('error', () => {
      resolve(true) // Port is available (connection refused)
    })
  })
}

// Find an available port starting from the given port
async function findAvailablePort(startPort: number): Promise<number> {
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const port = startPort + attempt
    if (await isPortAvailable(port)) {
      return port
    }
    console.log(`Port ${port} is in use, trying ${port + 1}...`)
  }
  throw new Error(`Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts`)
}

async function main() {
  const port = await findAvailablePort(DEFAULT_PORT)

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

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
    console.log(`WebSocket server running on ws://localhost:${port}/ws/interview`)
    console.log(`GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'Set (' + process.env.GROQ_API_KEY.slice(0, 8) + '...)' : 'NOT SET'}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
