import { app, BrowserWindow, safeStorage } from 'electron'
import electronUpdater from 'electron-updater'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerAppProtocol, registerAppScheme } from './protocol'
import { createAppPaths, ensureAppPaths, migrateLegacyData, resolveUserDataDir } from './paths'
import { createServerApp, startServer, type RunningServer } from './server'
import { OpencodeService } from './services/opencode/manager'
import { QqService } from './services/qq/manager'
import { registerIpc } from './ipc'
import { createMainWindow } from './window'

registerAppScheme()
app.setName('Chatnip')

const userDataDir = process.env.CHATNIP_USER_DATA
  || resolveUserDataDir(process.platform, process.env, (name) => app.getPath(name))
app.setPath('userData', userDataDir)

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let server: RunningServer | null = null
let opencode: OpencodeService | null = null
let qq: QqService | null = null
let quitting = false

function sendStatus(): void {
  if (!mainWindow || !opencode || !qq) return
  mainWindow.webContents.send('chatnip:service-status', {
    opencode: opencode.status(),
    qq: qq.status(),
  })
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  const paths = createAppPaths(userDataDir)
  await ensureAppPaths(paths)
  await migrateLegacyData(paths, process.platform, process.env)

  const token = randomBytes(32).toString('base64url')
  const resourcesDir = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
  const rendererDir = join(app.getAppPath(), 'out/renderer')

  const secrets = {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (value: string) => safeStorage.encryptString(value).toString('base64'),
    decrypt: (value: string) => safeStorage.decryptString(Buffer.from(value, 'base64')),
  }

  opencode = new OpencodeService({ paths, resourcesDir, onStatus: sendStatus })
  qq = new QqService({ paths, secrets, onStatus: sendStatus })
  await qq.load()

  const opencodeService = opencode
  const qqService = qq

  server = await startServer(
    createServerApp({
      paths,
      token,
      fetchImpl: fetch,
      getQqConfig: () => qqService.getConfig(),
      saveQqConfig: async (config) => qqService.configure(config),
      getOpencodeEndpoint: () => opencodeService.getEndpoint(),
      restartOpencode: () => opencodeService.restart(),
    }),
  )

  registerAppProtocol(rendererDir)

  if (process.env.CHATNIP_SMOKE === '1') {
    writeFileSync(
      process.env.CHATNIP_SMOKE_RUNTIME || '/tmp/chatnip-smoke-runtime.json',
      JSON.stringify({ apiBase: `http://127.0.0.1:${server.port}`, token }),
      'utf-8',
    )
  }

  registerIpc({
    opencode: opencodeService,
    qq: qqService,
    installGuideUrl: qqService.getInstallGuideUrl(),
    getStatus: () => ({
      opencode: opencodeService.status(),
      qq: qqService.status(),
    }),
  })

  mainWindow = createMainWindow({
    preload: join(import.meta.dirname, '../preload/index.cjs'),
    apiBase: `http://127.0.0.1:${server.port}`,
    token,
    devUrl: process.env.ELECTRON_RENDERER_URL,
  })

  mainWindow.webContents.on('did-finish-load', () => sendStatus())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow({
        preload: join(import.meta.dirname, '../preload/index.cjs'),
        apiBase: `http://127.0.0.1:${server!.port}`,
        token,
        devUrl: process.env.ELECTRON_RENDERER_URL,
      })
      mainWindow.webContents.on('did-finish-load', () => sendStatus())
    }
  })

  // Services start in the background; the wizard shows their live status.
  if (process.env.CHATNIP_SKIP_SERVICES !== '1') {
    opencodeService.start().catch((err) => console.error('[opencode]', err))
    qqService.detect().catch((err) => console.error('[qq]', err))
  }

  if (app.isPackaged) {
    try {
      const { autoUpdater } = electronUpdater
      autoUpdater.autoDownload = false
      autoUpdater.checkForUpdatesAndNotify().catch((err) => console.warn('[updater]', err))
    } catch (err) {
      console.warn('[updater]', err)
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void (async () => {
    await Promise.allSettled([
      opencode?.stop() ?? Promise.resolve(),
      server?.close() ?? Promise.resolve(),
    ])
    app.quit()
  })()
})
