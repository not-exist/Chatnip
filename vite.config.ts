import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { spawn, execSync, type ChildProcess } from 'child_process'
import type { IncomingMessage, ServerResponse } from 'http'
import { createConnection } from 'net'

const OPENCODE_PORT = 4096
const NAPCAT_CONFIG_PATH = path.resolve(__dirname, 'napcat-target.json')
const CHAT_HISTORY_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'),
  'chatnip',
  'chat-history',
)
const APP_STATE_PATH = path.join(CHAT_HISTORY_DIR, '..', 'app-state.json')

let isSpawning = false

type RestartResult = 
  | { status: 'ok'; process: ChildProcess }
  | { status: 'in_progress' }
  | { status: 'port_occupied'; pid?: number }
  | { status: 'spawn_failed' }

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

// ── Phase 1: opencode Server Management ──

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection(port, '127.0.0.1')
    sock.on('connect', () => {
      sock.destroy()
      resolve(false)
    })
    sock.on('error', () => {
      sock.destroy()
      resolve(true)
    })
  })
}

function findOpencodeProcess(port: number): { pid: number; isOpencode: boolean } | null {
  try {
    const netstatOut = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' })
    const lines = netstatOut.trim().split('\r\n').filter(l => l.includes('LISTENING'))
    if (lines.length === 0) return null

    const pidMatch = lines[0].match(/\s+(\d+)\s*$/)
    if (!pidMatch) return null
    const pid = parseInt(pidMatch[1], 10)

    const tasklistOut = execSync(`tasklist /fi "PID eq ${pid}"`, { encoding: 'utf-8' })
    const isOpencode = /opencode|node/i.test(tasklistOut)

    return { pid, isOpencode }
  } catch {
    return null
  }
}

function spawnOpencode(port: number): ChildProcess | null {
  try {
    const child = spawn('opencode', ['serve', '--port', String(port)], {
      shell: true,
      windowsHide: true,
      stdio: 'pipe',
    })
    child.stdout?.on('data', (d: Buffer) => process.stdout.write(`[opencode] ${d}`))
    child.stderr?.on('data', (d: Buffer) => process.stderr.write(`[opencode] ${d}`))
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn('[opencode] 命令未找到，请确保已安装 opencode (npm i -g opencode-ai)')
      }
    })
    child.on('exit', (code) => {
      if (code && code > 0) {
        console.warn(`[opencode] 进程退出 (code=${code})`)
      }
    })
    console.log(`[opencode] 已启动，端口 ${port}`)
    return child
  } catch {
    return null
  }
}

async function restartOpencode(port: number): Promise<RestartResult> {
  if (isSpawning) {
    console.warn('[opencode] 正在重启中，跳过重复请求')
    return { status: 'in_progress' }
  }
  isSpawning = true
  try {
    if (await isPortFree(port)) {
      const proc = spawnOpencode(port)
      return proc 
        ? { status: 'ok', process: proc } 
        : { status: 'spawn_failed' }
    }
    const procInfo = findOpencodeProcess(port)
    if (procInfo?.isOpencode) {
      try { execSync(`taskkill /f /pid ${procInfo.pid}`) } catch { /* ignore */ }
      await new Promise(r => setTimeout(r, 1000))
      if (!(await isPortFree(port))) {
        console.warn(`[opencode] 无法释放端口 ${port}，进程 (PID: ${procInfo.pid}) 可能未被终止`)
        return { status: 'port_occupied', pid: procInfo.pid }
      }
      const proc = spawnOpencode(port)
      return proc 
        ? { status: 'ok', process: proc } 
        : { status: 'spawn_failed' }
    }
    console.warn(`[opencode] 端口 ${port} 被其他进程占用 (PID: ${procInfo?.pid}), 请手动释放`)
    return { status: 'port_occupied', pid: procInfo?.pid }
  } finally {
    isSpawning = false
  }
}

// ── Vite Plugin ──

function opencodePlugin() {
  let proc: ChildProcess | null = null

  return {
    name: 'vite-plugin-opencode',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      restartOpencode(OPENCODE_PORT).then(result => { 
        if (result.status === 'ok') proc = result.process 
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

      // ── Phase 1: opencode restart endpoint ──
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/__api/opencode/restart') {
          try {
            const result = await restartOpencode(OPENCODE_PORT)
            if (result.status === 'ok') {
              proc = result.process
              res.statusCode = 200
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } else if (result.status === 'in_progress') {
              res.statusCode = 202
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: true, message: '重启进行中' }))
            } else if (result.status === 'port_occupied') {
              res.statusCode = 409
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: '端口被其他进程占用' }))
            } else {
              res.statusCode = 500
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: 'Opencode 启动失败' }))
            }
          } catch {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: '重启失败' }))
          }
          return
        }
        next()
      })

      // ── Phase 2: app-state persistence endpoints ──
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
    },
    closeBundle() {
      if (proc && proc.pid) {
        try {
          execSync(`taskkill /f /t /pid ${proc.pid}`)
        } catch { /* process may have already exited */ }
        proc = null
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), opencodePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/opencode': {
        target: `http://127.0.0.1:${OPENCODE_PORT}`,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/opencode/, ''),
      },
    },
  },
})
