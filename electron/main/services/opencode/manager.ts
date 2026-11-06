import { spawn, type ChildProcess } from 'node:child_process'
import { chmod, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { createServer, type AddressInfo } from 'node:net'
import { randomBytes } from 'node:crypto'
import type { AppPaths } from '../../paths'
import { binaryName, loadManifest, targetKey } from './manifest'
import { downloadFile, extractArchive } from './download'

export type ServiceState = 'stopped' | 'installing' | 'starting' | 'ready' | 'error'

export interface OpencodeStatus {
  state: ServiceState
  version?: string
  port?: number
  error?: string
}

export interface OpencodeEndpoint {
  baseUrl: string
  password: string
}

export interface OpencodeServiceDeps {
  paths: AppPaths
  resourcesDir: string
  fetchImpl?: typeof fetch
  spawnImpl?: typeof spawn
  onStatus?: (status: OpencodeStatus) => void
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

async function findBinary(dir: string, name: string, depth = 0): Promise<string | null> {
  if (depth > 4) return null
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isFile() && entry.name === name) return path
    if (entry.isDirectory()) {
      const found = await findBinary(path, name, depth + 1)
      if (found) return found
    }
  }
  return null
}

export class OpencodeService {
  private readonly paths: AppPaths
  private readonly resourcesDir: string
  private readonly fetchImpl: typeof fetch
  private readonly spawnImpl: typeof spawn
  private readonly onStatus?: (status: OpencodeStatus) => void

  private child: ChildProcess | null = null
  private endpoint: OpencodeEndpoint | null = null
  private state: ServiceState = 'stopped'
  private version?: string
  private error?: string
  private installPromise: Promise<string> | null = null
  private startPromise: Promise<void> | null = null

  constructor(deps: OpencodeServiceDeps) {
    this.paths = deps.paths
    this.resourcesDir = deps.resourcesDir
    this.fetchImpl = deps.fetchImpl ?? fetch
    this.spawnImpl = deps.spawnImpl ?? spawn
    this.onStatus = deps.onStatus
  }

  status(): OpencodeStatus {
    return {
      state: this.state,
      version: this.version,
      port: this.endpoint ? Number(new URL(this.endpoint.baseUrl).port) : undefined,
      error: this.error,
    }
  }

  getEndpoint(): OpencodeEndpoint | null {
    return this.state === 'ready' ? this.endpoint : null
  }

  private setState(state: ServiceState, error?: string): void {
    this.state = state
    this.error = error
    this.onStatus?.(this.status())
  }

  async ensureInstalled(): Promise<string> {
    if (this.installPromise) return this.installPromise
    this.installPromise = this.installInternal().finally(() => {
      this.installPromise = null
    })
    return this.installPromise
  }

  private async installInternal(): Promise<string> {
    const manifest = await loadManifest(this.resourcesDir)
    this.version = manifest.version
    const key = targetKey()
    const target = manifest.targets[key]
    if (!target) {
      throw new Error(`No opencode build for ${key}`)
    }

    const dir = join(this.paths.bin, 'opencode', `${manifest.version}-${key}`)
    const binary = join(dir, binaryName())
    const versionFile = join(dir, '.version')
    try {
      const installedVersion = (await readFile(versionFile, 'utf-8')).trim()
      await stat(binary)
      if (installedVersion === manifest.version) return binary
    } catch {
      // not installed yet
    }

    this.setState('installing')
    await mkdir(this.paths.bin, { recursive: true })
    const archive = join(this.paths.bin, `opencode-${manifest.version}-${key}.${target.archive}`)
    const tempDir = `${dir}.tmp`

    try {
      await downloadFile({
        url: target.url,
        dest: archive,
        sha256: target.sha256,
        size: target.size,
        fetchImpl: this.fetchImpl,
      })
      await rm(tempDir, { recursive: true, force: true })
      await extractArchive(archive, tempDir, target.archive)
      const extracted = await findBinary(tempDir, target.binary)
      if (!extracted) throw new Error('opencode binary not found in archive')
      await chmod(extracted, 0o755).catch(() => {})
      await rm(dir, { recursive: true, force: true })
      await rename(tempDir, dir)
      await writeFile(versionFile, manifest.version, 'utf-8')
      await rm(archive, { force: true })
      this.setState('stopped')
      return binary
    } catch (err) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
      this.setState('error', String(err))
      throw err
    }
  }

  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise
    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  private async startInternal(): Promise<void> {
    if (this.endpoint && this.child && this.child.exitCode === null) return
    this.setState('starting')

    const binary = await this.ensureInstalled()
    const port = await freePort()
    const password = randomBytes(32).toString('base64url')
    const baseUrl = `http://127.0.0.1:${port}`

    await mkdir(this.paths.logs, { recursive: true })
    await mkdir(this.paths.workspace, { recursive: true })
    const logPath = join(this.paths.logs, 'opencode.log')
    const log = createWriteStream(logPath, { flags: 'a' })

    const child = this.spawnImpl(binary, ['serve', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: this.paths.workspace,
      env: {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: password,
        NO_COLOR: '1',
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child = child
    child.stdout?.pipe(log)
    child.stderr?.pipe(log)

    let exited = false
    child.once('exit', (code) => {
      exited = true
      if (this.state !== 'stopped') {
        this.endpoint = null
        this.setState('error', `opencode exited with code ${code ?? 'unknown'}`)
      }
    })

    const auth = 'Basic ' + Buffer.from(`opencode:${password}`).toString('base64')
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      if (exited) throw new Error(this.error ?? 'opencode exited during startup')
      try {
        const response = await this.fetchImpl(`${baseUrl}/global/health`, {
          headers: { authorization: auth },
          signal: AbortSignal.timeout(2_000),
        })
        if (response.ok) {
          const health = (await response.json()) as { healthy?: boolean; version?: string }
          if (health.healthy) {
            if (health.version && health.version !== this.version) {
              this.error = `opencode version mismatch: expected ${this.version}, got ${health.version}`
            }
            this.endpoint = { baseUrl, password }
            this.setState('ready')
            return
          }
        }
      } catch {
        // keep polling
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    child.kill('SIGTERM')
    this.endpoint = null
    this.setState('error', 'opencode did not become ready within 60s')
    throw new Error('opencode did not become ready within 60s')
  }

  async stop(): Promise<void> {
    const child = this.child
    this.child = null
    this.endpoint = null
    if (!child || child.exitCode !== null) {
      this.setState('stopped')
      return
    }
    child.kill('SIGTERM')
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
    await Promise.race([
      exited,
      new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
    ])
    if (child.exitCode === null) child.kill('SIGKILL')
    this.setState('stopped')
  }

  async restart(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.stop()
      await this.start()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }
}
