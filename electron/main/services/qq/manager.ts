import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppPaths } from '../../paths'
import { writeJsonAtomic } from '../../server/routes/appState'
import type { QqConfig, QqState, QqStatus, SecretStore } from './types'

const DEFAULT_CONFIG: QqConfig = {
  provider: 'napcat',
  baseUrl: 'http://127.0.0.1:3000',
  webUiUrl: 'http://127.0.0.1:6099',
}

interface StoredConfig {
  provider: 'napcat'
  baseUrl: string
  accessTokenEnc?: string
  accessTokenPlain?: string
  installDir?: string
  launcher?: string
  webUiUrl?: string
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function findInstallDir(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, configured?: string): Promise<string | null> {
  const candidates = [
    configured,
    platform === 'win32' ? env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'NapCat') : null,
    platform === 'win32' ? env.APPDATA && join(env.APPDATA, 'NapCat') : null,
    platform === 'darwin' ? '/Applications/NapCat' : null,
    platform === 'darwin' ? env.HOME && join(env.HOME, 'Library/Application Support/NapCat') : null,
    platform === 'linux' ? env.HOME && join(env.HOME, 'NapCat') : null,
    platform === 'linux' ? '/opt/NapCat' : null,
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate
  }
  return null
}

export interface QqServiceDeps {
  paths: AppPaths
  secrets: SecretStore
  fetchImpl?: typeof fetch
  spawnImpl?: typeof spawn
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  onStatus?: (status: QqStatus) => void
}

export class QqService {
  private readonly paths: AppPaths
  private readonly secrets: SecretStore
  private readonly fetchImpl: typeof fetch
  private readonly spawnImpl: typeof spawn
  private readonly platform: NodeJS.Platform
  private readonly env: NodeJS.ProcessEnv
  private readonly onStatus?: (status: QqStatus) => void

  private config: QqConfig = { ...DEFAULT_CONFIG }
  private state: QqState = 'unknown'
  private error?: string
  private installed = false
  private child: ChildProcess | null = null

  constructor(deps: QqServiceDeps) {
    this.paths = deps.paths
    this.secrets = deps.secrets
    this.fetchImpl = deps.fetchImpl ?? fetch
    this.spawnImpl = deps.spawnImpl ?? spawn
    this.platform = deps.platform ?? process.platform
    this.env = deps.env ?? process.env
    this.onStatus = deps.onStatus
  }

  private configPath(): string {
    return join(this.paths.config, 'qq.json')
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.configPath(), 'utf-8')
      const stored = JSON.parse(raw) as StoredConfig
      let accessToken: string | undefined
      if (stored.accessTokenEnc && this.secrets.isAvailable()) {
        try {
          accessToken = this.secrets.decrypt(stored.accessTokenEnc)
        } catch {
          accessToken = undefined
        }
      } else if (stored.accessTokenPlain) {
        accessToken = stored.accessTokenPlain
      }
      this.config = {
        provider: 'napcat',
        baseUrl: stored.baseUrl || DEFAULT_CONFIG.baseUrl,
        accessToken,
        installDir: stored.installDir,
        launcher: stored.launcher,
        webUiUrl: stored.webUiUrl || DEFAULT_CONFIG.webUiUrl,
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG }
    }
    const detected = await findInstallDir(this.platform, this.env, this.config.installDir)
    this.installed = Boolean(detected)
    if (detected && !this.config.installDir) this.config.installDir = detected
  }

  getConfig(): QqConfig {
    return { ...this.config }
  }

  getConfigForRenderer(): Omit<QqConfig, 'accessToken'> & { hasToken: boolean } {
    const { accessToken, ...rest } = this.config
    return { ...rest, hasToken: Boolean(accessToken) }
  }

  async configure(patch: Partial<QqConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...patch,
      provider: 'napcat',
      baseUrl: patch.baseUrl ?? this.config.baseUrl,
    }
    const stored: StoredConfig = {
      provider: 'napcat',
      baseUrl: this.config.baseUrl,
      installDir: this.config.installDir,
      launcher: this.config.launcher,
      webUiUrl: this.config.webUiUrl,
    }
    if (this.config.accessToken) {
      if (this.secrets.isAvailable()) {
        stored.accessTokenEnc = this.secrets.encrypt(this.config.accessToken)
      } else {
        // Last-resort fallback on Linux systems without a keyring.
        stored.accessTokenPlain = this.config.accessToken
      }
    }
    await mkdir(this.paths.config, { recursive: true })
    await writeJsonAtomic(this.configPath(), stored)
  }

  status(): QqStatus {
    return {
      installed: this.installed,
      state: this.state,
      baseUrl: this.config.baseUrl,
      webUiUrl: this.config.webUiUrl ?? DEFAULT_CONFIG.webUiUrl!,
      error: this.error,
    }
  }

  private setState(state: QqState, error?: string): void {
    this.state = state
    this.error = error
    this.onStatus?.(this.status())
  }

  async detect(): Promise<QqStatus> {
    const dir = await findInstallDir(this.platform, this.env, this.config.installDir)
    this.installed = Boolean(dir)
    if (dir) this.config.installDir = dir
    const healthy = await this.health()
    this.setState(healthy ? 'ready' : this.installed ? 'stopped' : 'unknown')
    return this.status()
  }

  async health(): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (this.config.accessToken) headers.authorization = `Bearer ${this.config.accessToken}`
      const response = await this.fetchImpl(`${this.config.baseUrl.replace(/\/+$/, '')}/get_login_info`, {
        method: 'POST',
        headers,
        body: '{}',
        signal: AbortSignal.timeout(3_000),
      })
      if (!response.ok) return false
      const body = (await response.json()) as { status?: string; retcode?: number }
      return body.retcode === 0 || body.status === 'ok'
    } catch {
      return false
    }
  }

  async start(): Promise<QqStatus> {
    if (await this.health()) {
      this.setState('ready')
      return this.status()
    }
    if (!this.config.launcher) {
      this.setState('stopped')
      return this.status()
    }
    this.setState('starting')
    try {
      this.child = this.spawnImpl(this.config.launcher, [], {
        cwd: this.config.installDir || this.paths.workspace,
        windowsHide: true,
        detached: false,
        stdio: 'ignore',
      })
      this.child.once('exit', (code) => {
        if (this.state !== 'ready') this.setState('error', `NapCat exited with code ${code ?? 'unknown'}`)
      })
    } catch (err) {
      this.setState('error', String(err))
      return this.status()
    }

    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      if (await this.health()) {
        this.setState('ready')
        return this.status()
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
    this.setState('error', 'NapCat did not become ready within 30s')
    return this.status()
  }

  async stop(): Promise<void> {
    if (this.child && this.child.exitCode === null) {
      this.child.kill('SIGTERM')
    }
    this.child = null
    this.setState('stopped')
  }

  getInstallGuideUrl(): string {
    return 'https://github.com/NapNeko/NapCatQQ/releases/latest'
  }
}
