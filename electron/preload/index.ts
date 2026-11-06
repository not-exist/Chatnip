import { contextBridge, ipcRenderer } from 'electron'

function getArg(name: string): string {
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : ''
}

const apiBase = getArg('chatnip-api-base')
const apiToken = getArg('chatnip-token')

export interface ServiceStatusPayload {
  opencode: { state: string; version?: string; port?: number; error?: string }
  qq: { installed: boolean; state: string; baseUrl: string; webUiUrl: string; error?: string }
}

contextBridge.exposeInMainWorld('chatnip', {
  apiBase,
  apiToken,
  version: process.versions.electron,
  platform: process.platform,
  getServiceStatus: () => ipcRenderer.invoke('chatnip:service-status') as Promise<ServiceStatusPayload>,
  installOpencode: () => ipcRenderer.invoke('chatnip:opencode-install') as Promise<{ ok: boolean; error?: string }>,
  restartOpencode: () => ipcRenderer.invoke('chatnip:opencode-restart') as Promise<{ ok: boolean; error?: string }>,
  openQqWebUi: () => ipcRenderer.invoke('chatnip:qq-open-webui') as Promise<{ ok: boolean; error?: string }>,
  openQqInstallGuide: () => ipcRenderer.invoke('chatnip:qq-install-guide') as Promise<{ ok: boolean }>,
  openExternal: (url: string) => ipcRenderer.invoke('chatnip:open-external', url) as Promise<{ ok: boolean; error?: string }>,
  onServiceStatus: (callback: (status: ServiceStatusPayload) => void) => {
    const listener = (_event: unknown, status: ServiceStatusPayload) => callback(status)
    ipcRenderer.on('chatnip:service-status', listener)
    return () => ipcRenderer.off('chatnip:service-status', listener)
  },
})
