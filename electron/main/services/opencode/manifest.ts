import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface OpencodeTarget {
  url: string
  sha256: string
  size: number
  archive: 'zip' | 'tar.gz'
  binary: string
}

export interface OpencodeManifest {
  version: string
  sdk: string
  targets: Record<string, OpencodeTarget>
}

export function targetKey(platform: NodeJS.Platform = process.platform, arch: string = process.arch): string {
  const os = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux'
  return `${os}-${arch}`
}

export function binaryName(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'opencode.exe' : 'opencode'
}

export async function loadManifest(resourcesDir: string): Promise<OpencodeManifest> {
  const raw = await readFile(join(resourcesDir, 'opencode-manifest.json'), 'utf-8')
  const manifest = JSON.parse(raw) as OpencodeManifest
  if (!manifest.version || !manifest.targets) {
    throw new Error('Invalid opencode manifest')
  }
  return manifest
}
