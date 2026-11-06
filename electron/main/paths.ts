import { cp, mkdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export interface AppPaths {
  userData: string
  chatHistory: string
  appState: string
  logs: string
  bin: string
  workspace: string
  config: string
}

export function resolveUserDataDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  appGetPath: (name: 'userData') => string,
): string {
  if (platform === 'win32' && env.LOCALAPPDATA) {
    // Keep the legacy data location used by the web build.
    return join(env.LOCALAPPDATA, 'chatnip')
  }
  return appGetPath('userData')
}

export function createAppPaths(userData: string): AppPaths {
  return {
    userData,
    chatHistory: join(userData, 'chat-history'),
    appState: join(userData, 'app-state.json'),
    logs: join(userData, 'logs'),
    bin: join(userData, 'bin'),
    workspace: join(userData, 'workspace'),
    config: join(userData, 'config'),
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Copy data from the pre-Electron web build (Windows `%LOCALAPPDATA%\chatnip`)
 * into the Electron userData dir. Idempotent; never overwrites an existing target.
 */
export async function migrateLegacyData(
  paths: AppPaths,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  if (platform !== 'win32' || !env.LOCALAPPDATA) return

  const legacyRoot = join(env.LOCALAPPDATA, 'chatnip')
  if (resolve(legacyRoot) === resolve(paths.userData)) return

  await mkdir(paths.userData, { recursive: true })

  const legacyState = join(legacyRoot, 'app-state.json')
  if (!(await exists(paths.appState)) && (await exists(legacyState))) {
    await cp(legacyState, paths.appState)
  }

  if (!(await exists(paths.chatHistory)) && (await exists(join(legacyRoot, 'chat-history')))) {
    await cp(join(legacyRoot, 'chat-history'), paths.chatHistory, { recursive: true })
  }
}

export async function ensureAppPaths(paths: AppPaths): Promise<void> {
  await Promise.all([
    mkdir(paths.userData, { recursive: true }),
    mkdir(paths.chatHistory, { recursive: true }),
    mkdir(paths.logs, { recursive: true }),
    mkdir(paths.bin, { recursive: true }),
    mkdir(paths.workspace, { recursive: true }),
    mkdir(paths.config, { recursive: true }),
  ])
}
