export interface ServiceStatusPayload {
  opencode: { state: string; version?: string; port?: number; error?: string }
  qq: { installed: boolean; state: string; baseUrl: string; webUiUrl: string; error?: string }
}

export interface ChatnipBridge {
  apiBase: string
  apiToken: string
  version: string
  platform: string
  getServiceStatus: () => Promise<ServiceStatusPayload>
  installOpencode: () => Promise<{ ok: boolean; error?: string }>
  restartOpencode: () => Promise<{ ok: boolean; error?: string }>
  openQqWebUi: () => Promise<{ ok: boolean; error?: string }>
  openQqInstallGuide: () => Promise<{ ok: boolean }>
  openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>
  onServiceStatus: (callback: (status: ServiceStatusPayload) => void) => () => void
}

declare global {
  interface Window {
    chatnip?: ChatnipBridge
  }
}

export function getBridge(): ChatnipBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.chatnip
}

export function getApiBase(): string {
  return getBridge()?.apiBase ?? ''
}

export function getApiToken(): string {
  return getBridge()?.apiToken ?? ''
}

export function apiUrl(path: string): string {
  return `${getApiBase()}${path}`
}

export function apiHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  const token = getApiToken()
  if (token) headers.set('x-chatnip-token', token)
  return headers
}

export const API_TIMEOUT_MS = 30_000

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = apiHeaders(init.headers)
  return fetch(apiUrl(path), {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(API_TIMEOUT_MS),
  })
}
