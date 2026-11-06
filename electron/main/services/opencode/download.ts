import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import AdmZip from 'adm-zip'
import * as tar from 'tar'

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

export interface DownloadOptions {
  url: string
  dest: string
  sha256: string
  size: number
  fetchImpl?: typeof fetch
}

export async function downloadFile(options: DownloadOptions): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch
  await mkdir(dirname(options.dest), { recursive: true })

  const part = `${options.dest}.part`
  let offset = await fileSize(part)
  const headers: Record<string, string> = {}
  if (offset > 0) headers.range = `bytes=${offset}-`

  const response = await fetchImpl(options.url, { headers, redirect: 'follow' })
  if (!response.ok && response.status !== 206) {
    throw new Error(`Download failed: HTTP ${response.status}`)
  }
  if (offset > 0 && response.status !== 206) {
    offset = 0
    await rm(part, { force: true })
  }
  if (!response.body) throw new Error('Download response has no body')

  await pipeline(
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
    createWriteStream(part, { flags: offset > 0 ? 'a' : 'w' }),
  )

  const actualSize = await fileSize(part)
  if (options.size > 0 && actualSize !== options.size) {
    await rm(part, { force: true })
    throw new Error(`Size mismatch: expected ${options.size}, got ${actualSize}`)
  }
  const digest = await sha256File(part)
  if (digest.toLowerCase() !== options.sha256.toLowerCase()) {
    await rm(part, { force: true })
    throw new Error('SHA-256 mismatch')
  }
  await rename(part, options.dest)
}

export async function extractArchive(archive: string, destDir: string, kind: 'zip' | 'tar.gz'): Promise<void> {
  await mkdir(destDir, { recursive: true })
  if (kind === 'zip') {
    const zip = new AdmZip(archive)
    zip.extractAllTo(destDir, true)
    return
  }
  await tar.x({ file: archive, cwd: destDir })
}
