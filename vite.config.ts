import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { spawn, execSync, type ChildProcess } from 'child_process'
import net from 'net'
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
  return ['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length'].includes(k.toLowerCase())
}

// ── Vite Plugin ──

function chatnipPlugin() {
  return {
    name: 'vite-plugin-chatnip',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      // ── Opencode Serve lifecycle ──
      let opencodeProc: ChildProcess | null = null
      let opencodeReady = false
      let restarting = false

      const OPENCODE_TARGET = 'http://127.0.0.1:4096'

      // ── Port helpers ──
      function checkPort(port: number): Promise<boolean> {
        return new Promise((resolve) => {
          const server = net.createServer()
          server.once('error', () => resolve(false))
          server.listen(port, '127.0.0.1', () => {
            server.close(() => resolve(true))
          })
        })
      }

      async function getPidByPort(port: number): Promise<number | null> {
        try {
          if (process.platform === 'win32') {
            const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' })
            const lines = out.trim().split(/\r?\n/)
            for (const line of lines) {
              if (line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/)
                const pid = parseInt(parts[parts.length - 1], 10)
                if (!isNaN(pid)) return pid
              }
            }
          } else {
            const out = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' })
            const pid = parseInt(out.trim(), 10)
            if (!isNaN(pid)) return pid
          }
        } catch { /* command failed, port likely free */ }
        return null
      }

      async function getProcessName(pid: number): Promise<string | null> {
        try {
          if (process.platform === 'win32') {
            const out = execSync(`tasklist /fi "PID eq ${pid}" /fo csv /nh`, { encoding: 'utf-8' })
            const match = out.match(/^"([^"]+)"/m)
            if (match) return match[1]
          } else {
            const out = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf-8' })
            return out.trim() || null
          }
        } catch { /* process may have exited */ }
        return null
      }

      function doSpawn() {
        opencodeProc = spawn('npx', ['opencode', 'serve'], {
          cwd: path.resolve(__dirname),
          shell: true,
          windowsHide: true,
          stdio: 'pipe',
        })
        opencodeProc.stdout?.on('data', (d: Buffer) => {
          process.stdout.write(`[opencode] ${d}`)
        })
        opencodeProc.stderr?.on('data', (d: Buffer) => process.stderr.write(`[opencode] ${d}`))
        opencodeProc.on('exit', (code) => {
          opencodeReady = false
          if (code !== null && code !== 0 && !restarting) {
            console.warn(`[opencode] exited with code ${code} — 请在设置页点击"重启 Server"按钮重新启动`)
          }
        })
      }

      async function spawnOpencode() {
        const portFree = await checkPort(4096)
        if (portFree) {
          doSpawn()
          return
        }

        const pid = await getPidByPort(4096)
        if (pid) {
          const name = await getProcessName(pid)
          if (name && name.toLowerCase().includes('opencode')) {
            console.log(`[opencode] killing existing opencode process (PID ${pid}) on port 4096...`)
            try {
              if (process.platform === 'win32') {
                execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' })
              } else {
                process.kill(pid, 'SIGKILL')
              }
              await new Promise(r => setTimeout(r, 1000))
              doSpawn()
              return
            } catch { /* kill failed, fall through to warning */ }
          }
        }

        console.warn(`[opencode] 端口 4096 已被其他程序占用，无法启动 opencode serve。请关闭占用该端口的程序后，在设置页点击"重启 Server"按钮。`)
      }

      async function pollReady(): Promise<boolean> {
        const deadline = Date.now() + 30000
        while (Date.now() < deadline) {
          try {
            const res = await fetch(`${OPENCODE_TARGET}/session`)
            if (res.ok || res.status === 404) {
              // 404 means server is up but no project dir — that's fine
              opencodeReady = true
              console.log('[opencode] server ready')
              return true
            }
          } catch { /* connection refused, keep polling */ }
          await new Promise(r => setTimeout(r, 1000))
        }
        console.warn('[opencode] server did not become ready within 30s — continuing without proxy')
        return false
      }

      // Start opencode and poll readiness (non-blocking)
      spawnOpencode()
      pollReady()

      // Cleanup on Vite shutdown
      server.httpServer?.on('close', () => {
        if (opencodeProc && !opencodeProc.killed) {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(opencodeProc.pid), '/f', '/t'], { windowsHide: true, stdio: 'ignore' })
          } else {
            opencodeProc.kill('SIGTERM')
          }
        }
      })

      // Opencode proxy middleware
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/opencode')) return next()

        if (!opencodeReady) {
          res.statusCode = 503
          res.setHeader('content-type', 'application/json')
          res.setHeader('retry-after', '5')
          res.end(JSON.stringify({ error: 'Opencode server not ready' }))
          return
        }

        try {
          const targetPath = req.url.replace(/^\/api\/opencode/, '') || '/'
          const targetUrl = new URL(targetPath, OPENCODE_TARGET)
          const body = await rawBody(req)

          const fetchRes = await fetch(targetUrl, {
            method: req.method,
            headers: {
              ...filterHeaders(req.headers as Record<string, string | string[] | undefined>),
              host: targetUrl.host,
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
            res.end(JSON.stringify({ error: 'Opencode 连接失败' }))
          }
        }
      })

      // Opencode restart endpoint
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url !== '/__api/opencode/restart') return next()

        if (restarting) {
          res.statusCode = 409
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: '重启进行中' }))
          return
        }

        restarting = true
        opencodeReady = false

        try {
          // Kill existing process
          if (opencodeProc && !opencodeProc.killed) {
            if (process.platform === 'win32') {
              spawn('taskkill', ['/pid', String(opencodeProc.pid), '/f', '/t'], { windowsHide: true, stdio: 'ignore' })
            } else {
              opencodeProc.kill('SIGTERM')
            }
            // Wait for process to exit
            await new Promise<void>((resolve) => {
              const check = setInterval(() => {
                if (opencodeProc?.killed) { clearInterval(check); resolve() }
              }, 200)
              setTimeout(() => { clearInterval(check); resolve() }, 5000)
            })
          }

          // Spawn new process
          spawnOpencode()
          const ready = await pollReady()

          if (ready) {
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } else {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: '启动超时' }))
          }
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: String(err) }))
        } finally {
          restarting = false
        }
      })

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
