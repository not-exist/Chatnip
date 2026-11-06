export interface QqConfig {
  provider: 'napcat'
  baseUrl: string
  accessToken?: string
  installDir?: string
  launcher?: string
  webUiUrl?: string
}

export type QqState = 'unknown' | 'stopped' | 'starting' | 'ready' | 'error'

export interface QqStatus {
  installed: boolean
  state: QqState
  baseUrl: string
  webUiUrl: string
  error?: string
}

export interface SecretStore {
  isAvailable(): boolean
  encrypt(value: string): string
  decrypt(value: string): string
}
