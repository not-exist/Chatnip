import { Hono } from 'hono'

export interface QqConfig {
  baseUrl: string
  accessToken?: string
}

export interface NapcatRouteDeps {
  fetchImpl: typeof fetch
  getConfig: () => QqConfig
  saveConfig: (config: QqConfig) => Promise<void>
}

function parseBaseUrl(raw: string): URL {
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http/https baseUrl is allowed')
  }
  return url
}

export function createNapcatRoutes(deps: NapcatRouteDeps): Hono {
  const app = new Hono()

  app.all('/api/napcat/*', async (c) => {
    let config: QqConfig
    try {
      config = deps.getConfig()
      parseBaseUrl(config.baseUrl)
    } catch {
      return c.json({ error: 'NapCat 配置无效' }, 502)
    }

    const suffix = c.req.path.replace(/^\/api\/napcat/, '') || '/'
    const target = new URL(config.baseUrl.replace(/\/+$/, '') + suffix)
    const search = new URL(c.req.url).search
    if (search) target.search = search

    const headers = new Headers()
    const contentType = c.req.header('content-type')
    if (contentType) headers.set('content-type', contentType)
    if (config.accessToken) headers.set('authorization', `Bearer ${config.accessToken}`)

    const method = c.req.method
    const body = method === 'GET' || method === 'HEAD' ? undefined : await c.req.arrayBuffer()

    try {
      const upstream = await deps.fetchImpl(target, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(30_000),
      })
      const responseHeaders = new Headers(upstream.headers)
      responseHeaders.delete('content-encoding')
      responseHeaders.delete('content-length')
      responseHeaders.delete('transfer-encoding')
      const buffer = await upstream.arrayBuffer()
      return new Response(buffer, { status: upstream.status, headers: responseHeaders })
    } catch (err) {
      return c.json({ error: 'NapCat 连接失败', detail: String(err) }, 502)
    }
  })

  app.post('/__api/napcat-config', async (c) => {
    const body = await c.req.json().catch(() => null) as
      | { baseUrl?: unknown; accessToken?: unknown }
      | null
    if (!body || typeof body.baseUrl !== 'string') {
      return c.json({ ok: false, error: 'Missing baseUrl' }, 400)
    }
    try {
      parseBaseUrl(body.baseUrl)
    } catch {
      return c.json({ ok: false, error: 'Invalid baseUrl' }, 400)
    }
    await deps.saveConfig({
      baseUrl: body.baseUrl,
      accessToken: typeof body.accessToken === 'string' ? body.accessToken : undefined,
    })
    return c.json({ ok: true })
  })

  return app
}
