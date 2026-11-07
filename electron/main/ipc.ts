import { ipcMain, shell } from 'electron'
import type { OpencodeService } from './services/opencode/manager'
import type { QqService } from './services/qq/manager'

export interface IpcDeps {
  opencode: OpencodeService
  qq: QqService
  installGuideUrl: string
  getStatus: () => unknown
}

function isSafeExternalUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

export function registerIpc(deps: IpcDeps): void {
  ipcMain.handle('chatnip:service-status', () => deps.getStatus())

  ipcMain.handle('chatnip:opencode-install', async () => {
    try {
      await deps.opencode.ensureInstalled()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('chatnip:opencode-restart', () => deps.opencode.restart())

  ipcMain.handle('chatnip:qq-open-webui', async () => {
    const url = deps.qq.status().webUiUrl
    if (!isSafeExternalUrl(url)) return { ok: false, error: 'Invalid WebUI URL' }
    await shell.openExternal(url)
    return { ok: true }
  })

  ipcMain.handle('chatnip:qq-install-guide', async () => {
    await shell.openExternal(deps.installGuideUrl)
    return { ok: true }
  })

  ipcMain.handle('chatnip:open-external', async (_event, url: unknown) => {
    if (!isSafeExternalUrl(url)) return { ok: false, error: 'Invalid URL' }
    await shell.openExternal(url)
    return { ok: true }
  })
}
