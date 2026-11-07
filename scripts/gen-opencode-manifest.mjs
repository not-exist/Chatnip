#!/usr/bin/env node
/**
 * Generates resources/opencode-manifest.json from the pinned GitHub Release.
 * Usage: node scripts/gen-opencode-manifest.mjs [version]
 * Set GITHUB_TOKEN to avoid API rate limits in CI.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const version = process.argv[2] || process.env.OPENCODE_VERSION || '1.19.5'
const repo = 'anomalyco/opencode'

const TARGETS = {
  'win32-x64': { asset: 'opencode-windows-x64.zip', archive: 'zip', binary: 'opencode.exe' },
  'win32-arm64': { asset: 'opencode-windows-arm64.zip', archive: 'zip', binary: 'opencode.exe' },
  'darwin-x64': { asset: 'opencode-darwin-x64.zip', archive: 'zip', binary: 'opencode' },
  'darwin-arm64': { asset: 'opencode-darwin-arm64.zip', archive: 'zip', binary: 'opencode' },
  'linux-x64': { asset: 'opencode-linux-x64.tar.gz', archive: 'tar.gz', binary: 'opencode' },
  'linux-arm64': { asset: 'opencode-linux-arm64.tar.gz', archive: 'tar.gz', binary: 'opencode' },
}

const headers = { accept: 'application/vnd.github+json' }
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`

const response = await fetch(`https://api.github.com/repos/${repo}/releases/tags/v${version}`, { headers })
if (!response.ok) {
  throw new Error(`GitHub API ${response.status}: ${await response.text()}`)
}
const release = await response.json()
const assets = new Map(release.assets.map((asset) => [asset.name, asset]))

const targets = {}
for (const [key, spec] of Object.entries(TARGETS)) {
  const asset = assets.get(spec.asset)
  if (!asset) {
    console.warn(`skip ${key}: asset ${spec.asset} not found`)
    continue
  }
  const digest = String(asset.digest || '')
  if (!digest.startsWith('sha256:')) {
    throw new Error(`Missing sha256 digest for ${spec.asset}`)
  }
  targets[key] = {
    url: asset.browser_download_url,
    sha256: digest.slice('sha256:'.length),
    size: asset.size,
    archive: spec.archive,
    binary: spec.binary,
  }
}

const manifest = { version, sdk: version, targets }
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'resources', 'opencode-manifest.json')
await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
console.log(`wrote ${out} (${Object.keys(targets).length} targets, v${version})`)
