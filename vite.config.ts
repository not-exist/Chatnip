import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'

const NAPCAT_CONFIG_PATH = path.resolve(__dirname, 'napcat-target.json')
const CHAT_HISTORY_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'),
  'chatnip',
  'chat-history',
)
const APP_STATE_PATH = path.join(CHAT_HISTORY_DIR, '..', 'app-state.json')

interface NapcatTarget {
  host: string
  port: number
}

function readNapcatTarget(): NapcatTarget {
  try {
    const raw = fs.readFileSync(NAPCAT_CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed.host && typeof parsed.port === 'number') {
      return { host: parsed.host, port: parsed.port }
    }
  } catch { /* use defaults */ }
  return { host: '127.0.0.1', port: 3000 }
}

function rawBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(chunks.length > 0 ? Buffer.concat(chunks) : null))
  })
}

function filterHeaders(headers: Record<string, string | string[] | undefined>) {
  const skip = new Set(['host', 'connection', 'content-length', 'transfer-encoding'])
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (skip.has(k.toLowerCase())) continue
    out[k] = Array.isArray(v) ? v.join(', ') : v ?? ''
  }
  return out
}

async function napcatProxy(req: IncomingMessage, res: ServerResponse) {
  if (!req.url?.startsWith('/api/napcat')) return false

  try {
    const { host, port } = readNapcatTarget()
    const targetPath = req.url.replace(/^\/api\/napcat/, '') || '/'
    const targetUrl = new URL(targetPath, `http://${host}:${port}`)
    const body = await rawBody(req)

    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...filterHeaders(req.headers as Record<string, string | string[] | undefined>),
        host: `${host}:${port}`,
      },
      body,
    })

    res.statusCode = fetchRes.status || 502
    fetchRes.headers.forEach((v, k) => {
      if (!skipProxyHeader(k)) res.setHeader(k, v)
    })

    const resBody = await fetchRes.arrayBuffer()
    res.end(Buffer.from(resBody))
  } catch {
    if (!res.headersSent) {
      res.statusCode = 502
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'NapCat 连接失败' }))
    }
  }
  return true
}

function skipProxyHeader(k: string) {
  return ['transfer-encoding', 'connection', 'keep-alive'].includes(k.toLowerCase())
}

// ── Vite Plugin ──

function chatnipPlugin() {
  return {
    name: 'vite-plugin-chatnip',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      // NapCat dynamic proxy middleware
      server.middlewares.use(async (req, res, next) => {
        if (await napcatProxy(req, res)) return
        next()
      })

      // Config sync endpoint — SettingsPage writes host/port here
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/__api/napcat-config') {
          try {
            const body = await rawBody(req)
            const data = body ? JSON.parse(body.toString()) : {}
            fs.writeFileSync(NAPCAT_CONFIG_PATH, JSON.stringify({
              host: data.host || '127.0.0.1',
              port: Number(data.port) || 3000,
            }, null, 2))
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false }))
          }
          return
        }
        next()
      })

      // Chat history file write endpoint
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/__api/chat-history/write') {
          try {
            const body = await rawBody(req)
            const data = body ? JSON.parse(body.toString()) : {}
            const { filename, content } = data
            if (!filename || content === undefined) {
              res.statusCode = 400
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: 'Missing filename or content' }))
              return
            }
            const safeName = path.basename(filename)
            if (safeName !== filename || safeName === '' || safeName === '..') {
              res.statusCode = 400
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: 'Invalid filename' }))
              return
            }
            fs.mkdirSync(CHAT_HISTORY_DIR, { recursive: true })
            const filePath = path.join(CHAT_HISTORY_DIR, safeName)
            fs.writeFileSync(filePath, content, 'utf-8')
            const url = 'file:///' + filePath.replace(/\\/g, '/')
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, url }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
          return
        }
        next()
      })

      // Chat history cleanup endpoint
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'DELETE' && req.url === '/__api/chat-history/clean') {
          try {
            if (fs.existsSync(CHAT_HISTORY_DIR)) {
              fs.rmSync(CHAT_HISTORY_DIR, { recursive: true, force: true })
            }
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
          return
        }
        next()
      })

      // App-state persistence — save
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/__api/app-state/save') {
          try {
            const body = await rawBody(req)
            const { key, data } = body ? JSON.parse(body.toString()) : {}
            if (!key || data === undefined) {
              res.statusCode = 400
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: 'Missing key or data' }))
              return
            }
            let existing: Record<string, unknown> = {}
            try {
              if (fs.existsSync(APP_STATE_PATH)) {
                existing = JSON.parse(fs.readFileSync(APP_STATE_PATH, 'utf-8'))
              }
            } catch { /* reset on corruption */ }
            existing[key] = data
            fs.mkdirSync(path.dirname(APP_STATE_PATH), { recursive: true })
            fs.writeFileSync(APP_STATE_PATH, JSON.stringify(existing, null, 2))
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false }))
          }
          return
        }
        next()
      })

      // App-state persistence — load
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'GET' && req.url === '/__api/app-state/load') {
          try {
            let state: Record<string, unknown> = {}
            if (fs.existsSync(APP_STATE_PATH)) {
              state = JSON.parse(fs.readFileSync(APP_STATE_PATH, 'utf-8'))
            }
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(state))
          } catch {
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({}))
          }
          return
        }
        next()
      })

      // AI stream endpoint (skeleton)
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/api/ai/stream') {
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ status: 'not implemented' }))
          return
        }
        next()
      })

      // AI ask endpoint (skeleton)
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/api/ai/ask') {
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ status: 'not implemented' }))
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), chatnipPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
