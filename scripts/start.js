import { spawn } from 'child_process'
import { platform } from 'os'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const isWin = platform() === 'win32'

console.log('启动 chatnip...')

const vite = spawn('npx', ['vite'], {
  cwd: root,
  shell: true,
  windowsHide: true,
  stdio: isWin ? 'pipe' : 'inherit',
})

vite.stdout.on('data', (d) => process.stdout.write(`[vite] ${d}`))
vite.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`))
vite.on('error', (err) => console.error('[vite]', err.message))

process.on('SIGINT', () => {
  if (isWin) {
    spawn('taskkill', ['/pid', String(vite.pid), '/f', '/t'], { windowsHide: true, stdio: 'ignore' })
  } else {
    vite.kill('SIGTERM')
  }
  process.exit()
})
