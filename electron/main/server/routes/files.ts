import { mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Hono } from 'hono'
import type { AppPaths } from '../../paths'

const ANALYSIS_ID = /^[A-Za-z0-9_-]{1,64}$/
const MAX_FILE_BYTES = 8 * 1024 * 1024

export function analysisDir(paths: AppPaths, analysisId: string): string {
  if (!ANALYSIS_ID.test(analysisId)) {
    throw new Error('Invalid analysisId')
  }
  return join(paths.chatHistory, analysisId)
}

function safeFilePath(paths: AppPaths, analysisId: string, filename: string): string {
  if (filename !== basename(filename) || filename === '' || filename === '.' || filename === '..') {
    throw new Error('Invalid filename')
  }
  if (filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename')
  }
  const dir = analysisDir(paths, analysisId)
  const file = resolve(dir, filename)
  if (!file.startsWith(resolve(dir) + sep)) {
    throw new Error('Invalid path')
  }
  return file
}

export function createFilesRoutes(paths: AppPaths): Hono {
  const app = new Hono()

  app.post('/__api/chat-history/write', async (c) => {
    const body = await c.req.json().catch(() => null) as
      | { analysisId?: unknown; filename?: unknown; content?: unknown }
      | null
    if (!body || typeof body.analysisId !== 'string' || typeof body.filename !== 'string' || typeof body.content !== 'string') {
      return c.json({ ok: false, error: 'Missing analysisId, filename or content' }, 400)
    }
    if (Buffer.byteLength(body.content, 'utf-8') > MAX_FILE_BYTES) {
      return c.json({ ok: false, error: 'File too large' }, 413)
    }
    try {
      const file = safeFilePath(paths, body.analysisId, body.filename)
      await mkdir(analysisDir(paths, body.analysisId), { recursive: true })
      await writeFile(file, body.content, 'utf-8')
      return c.json({ ok: true, url: pathToFileURL(file).href })
    } catch (err) {
      return c.json({ ok: false, error: String(err) }, 500)
    }
  })

  app.delete('/__api/chat-history/clean', async (c) => {
    const body = await c.req.json().catch(() => null) as { analysisId?: unknown } | null
    if (!body || typeof body.analysisId !== 'string') {
      return c.json({ ok: false, error: 'Missing analysisId' }, 400)
    }
    try {
      await rm(analysisDir(paths, body.analysisId), { recursive: true, force: true })
      return c.json({ ok: true })
    } catch (err) {
      return c.json({ ok: false, error: String(err) }, 500)
    }
  })

  return app
}
