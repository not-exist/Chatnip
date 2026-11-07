import { app, BrowserWindow, session, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { applySessionSecurity, buildWebPreferences, isAllowedNavigation } from './security'

export interface MainWindowOptions {
  preload: string
  apiBase: string
  token: string
  devUrl?: string
}

export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  applySessionSecurity(session.defaultSession, options.devUrl)

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    webPreferences: buildWebPreferences(options.preload, [
      `--chatnip-api-base=${options.apiBase}`,
      `--chatnip-token=${options.token}`,
    ]),
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, options.devUrl)) {
      event.preventDefault()
    }
  })

  // M0/M1 smoke hook: render, capture a screenshot, then quit.
  if (process.env.CHATNIP_SMOKE === '1') {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await win.webContents.capturePage()
        writeFileSync(
          process.env.CHATNIP_SMOKE_OUT || '/tmp/chatnip-electron.png',
          image.toPNG(),
        )
        app.quit()
      }, Number(process.env.CHATNIP_SMOKE_DELAY ?? 2000))
    })
  }

  if (options.devUrl) {
    win.loadURL(options.devUrl)
  } else {
    win.loadURL(`app://chatnip${process.env.CHATNIP_SMOKE_PATH ?? '/'}`)
  }

  return win
}
