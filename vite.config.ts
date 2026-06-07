import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { spawn, type ChildProcess } from 'child_process'
import type { IncomingMessage, ServerResponse } from 'http'

const OPENCODE_PORT = 4096
const NAPCAT_CONFIG_PATH = path.resolve(__dirname, 'napcat-target.json')

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

function opencodePlugin() {
  let proc: ChildProcess | null = null

  return {
    name: 'vite-plugin-opencode',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      proc = spawn('opencode', ['serve', '--port', String(OPENCODE_PORT)], {
        shell: true,
        windowsHide: true,
        stdio: 'pipe',
      })
      proc.stdout?.on('data', (d: Buffer) => process.stdout.write(`[opencode] ${d}`))
      proc.stderr?.on('data', (d: Buffer) => process.stderr.write(`[opencode] ${d}`))
      proc.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          console.warn('[opencode] 命令未找到，请确保已安装 opencode (npm i -g opencode-ai)')
        }
      })
      proc.on('exit', (code) => {
        if (code && code > 0) {
          console.warn(`[opencode] 进程退出 (code=${code})`)
        }
      })
      console.log(`[opencode] 已启动，端口 ${OPENCODE_PORT}`)

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
    },
    closeBundle() {
      if (proc) {
        proc.kill()
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
    proxy: {
      '/api/opencode': {
        target: `http://127.0.0.1:${OPENCODE_PORT}`,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/opencode/, ''),
      },
    },
  },
})
