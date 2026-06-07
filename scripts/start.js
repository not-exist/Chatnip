import { spawn } from 'child_process'
import { platform } from 'os'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const isWin = platform() === 'win32'

const OPENCODE_PORT = 4096
const VITE_PORT = 5173

function startProc(command, args, label) {
  const proc = spawn(command, args, {
    cwd: root,
    shell: true,
    windowsHide: true,
    stdio: isWin ? 'pipe' : 'inherit',
  })

  proc.stdout.on('data', (d) => process.stdout.write(`[${label}] ${d}`))
  proc.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d}`))

  proc.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error(`[${label}] 命令不存在: ${command}`)
    } else {
      console.error(`[${label}] 启动失败:`, err.message)
    }
  })

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null && proc.exitCode !== -1) {
      console.error(`[${label}] 进程退出，退出码 ${code}`)
    }
  })

  return proc
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status < 500) return true
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

console.log('启动 opencode serve (port 4096, cors)...')
const opencode = startProc('opencode', [
  'serve',
  '--port', String(OPENCODE_PORT),
  '--cors', `http://localhost:${VITE_PORT}`,
], 'opencode')

console.log('启动 vite 开发服务器...')
const vite = startProc('npx', ['vite', '--port', String(VITE_PORT)], 'vite')

let cleaning = false

async function cleanup() {
  if (cleaning) return
  cleaning = true

  if (isWin) {
    spawn('taskkill', ['/pid', String(opencode.pid), '/f', '/t'], { windowsHide: true, stdio: 'ignore' })
    spawn('taskkill', ['/pid', String(vite.pid), '/f', '/t'], { windowsHide: true, stdio: 'ignore' })
  } else {
    opencode.kill('SIGTERM')
    vite.kill('SIGTERM')
  }
  process.exit()
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Wait for opencode to be ready, then open browser
const opencodeUrl = `http://127.0.0.1:${OPENCODE_PORT}`
console.log(`等待 opencode 就绪 (${opencodeUrl})...`)
const ready = await waitForHttp(opencodeUrl, 60000)

const appUrl = `http://localhost:${VITE_PORT}`
if (ready) {
  console.log('opencode 已就绪')
  console.log(`打开浏览器 ${appUrl}`)
  spawn(isWin ? 'start' : 'open', [appUrl], { shell: true, windowsHide: true, stdio: 'ignore' })
} else {
  console.error('opencode 启动超时，请手动检查')
}
