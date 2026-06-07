import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { spawn, type ChildProcess } from 'child_process'

const OPENCODE_PORT = 4096

function opencodePlugin() {
  let proc: ChildProcess | null = null

  return {
    name: 'vite-plugin-opencode',
    configureServer() {
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
      '/api/napcat': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/napcat/, ''),
      },
      '/api/opencode': {
        target: `http://127.0.0.1:${OPENCODE_PORT}`,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/opencode/, ''),
      },
    },
  },
})
