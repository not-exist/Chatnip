import { spawn } from 'child_process'
import { platform } from 'os'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const isWin = platform() === 'win32'

function startProc(command, args, label) {
  const opts = {
    cwd: root,
    shell: true,
    windowsHide: true,
    stdio: isWin ? 'pipe' : 'inherit',
  }

  const proc = spawn(command, args, opts)

  if (isWin) {
    proc.stdout.on('data', (d) => process.stdout.write(`[${label}] ${d}`))
    proc.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d}`))
  }

  proc.on('error', (err) => {
    console.error(`[${label}] 启动失败:`, err.message)
  })

  return proc
}

console.log('启动 opencode serve...')
const opencode = startProc('opencode', ['serve'], 'opencode')

console.log('启动 vite 开发服务器...')
const vite = startProc('npx', ['vite'], 'vite')

function cleanup() {
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
process.on('exit', cleanup)

setTimeout(() => {
  console.log('打开浏览器 http://localhost:5173')
  spawn(isWin ? 'start' : 'open', ['http://localhost:5173'], { shell: true, windowsHide: true, stdio: 'ignore' })
}, 3000)
