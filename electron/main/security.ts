import type { Session, WebPreferences } from 'electron'

export function buildWebPreferences(preload: string, additionalArguments: string[] = []): WebPreferences {
  return {
    preload,
    additionalArguments,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webviewTag: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
  }
}

export function isAllowedNavigation(rawUrl: string, devUrl?: string): boolean {
  if (rawUrl.startsWith('app://chatnip/')) return true
  if (devUrl && rawUrl.startsWith(devUrl)) return true
  return false
}

export function applySessionSecurity(session: Session, devUrl?: string): void {
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  session.setPermissionCheckHandler(() => false)

  session.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith('app://chatnip/')) {
      const headers = details.responseHeaders ?? {}
      callback({
        responseHeaders: {
          ...headers,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob: https:; font-src 'self' data:; " +
              "connect-src 'self' http://127.0.0.1:* http://localhost:*; " +
              "object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
          ],
        },
      })
      return
    }
    callback({ responseHeaders: details.responseHeaders })
  })

  // Keep devtools usable but do not allow remote navigation.
  void devUrl
}
