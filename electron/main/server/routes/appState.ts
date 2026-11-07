import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Hono } from 'hono'
import type { AppPaths } from '../../paths'

async function readJson(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await rename(tmp, path)
}

export function createAppStateRoutes(paths: AppPaths): Hono {
  const app = new Hono()

  app.post('/__api/app-state/save', async (c) => {
    const body = await c.req.json().catch(() => null) as { key?: unknown; data?: unknown } | null
    if (!body || typeof body.key !== 'string' || !body.key || body.data === undefined) {
      return c.json({ ok: false, error: 'Missing key or data' }, 400)
    }
    const state = await readJson(paths.appState)
    state[body.key] = body.data
    await writeJsonAtomic(paths.appState, state)
    return c.json({ ok: true })
  })

  app.get('/__api/app-state/load', async (c) => {
    return c.json(await readJson(paths.appState))
  })

  return app
}
