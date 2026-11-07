import { Hono } from 'hono'

export interface OpencodeEndpoint {
  baseUrl: string
  password: string
}

export interface OpencodeRouteDeps {
  fetchImpl: typeof fetch
  getEndpoint: () => OpencodeEndpoint | null
  restart: () => Promise<{ ok: boolean; error?: string }>
}

function basicAuth(password: string): string {
  return 'Basic ' + Buffer.from(`opencode:${password}`).toString('base64')
}

function passthroughHeaders(source: Headers): Headers {
  const headers = new Headers(source)
  headers.delete('content-encoding')
  headers.delete('content-length')
  headers.delete('transfer-encoding')
  headers.delete('connection')
  return headers
}

export function createOpencodeRoutes(deps: OpencodeRouteDeps): Hono {
  const app = new Hono()

  app.all('/api/opencode/*', async (c) => {
    const endpoint = deps.getEndpoint()
    if (!endpoint) {
      return c.json({ error: 'Opencode server not ready' }, 503, { 'retry-after': '2' })
    }

    const suffix = c.req.path.replace(/^\/api\/opencode/, '') || '/'
    const target = new URL(endpoint.baseUrl.replace(/\/+$/, '') + suffix)
    const search = new URL(c.req.url).search
    if (search) target.search = search

    const headers = new Headers()
    const contentType = c.req.header('content-type')
    if (contentType) headers.set('content-type', contentType)
    const accept = c.req.header('accept')
    if (accept) headers.set('accept', accept)
    headers.set('authorization', basicAuth(endpoint.password))

    const method = c.req.method
    const body = method === 'GET' || method === 'HEAD' ? undefined : await c.req.arrayBuffer()

    try {
      const upstream = await deps.fetchImpl(target, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(10 * 60_000),
      })

      const responseHeaders = passthroughHeaders(upstream.headers)
      const isSse = (upstream.headers.get('content-type') ?? '').includes('text/event-stream')
      if (isSse && upstream.body) {
        return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
      }
      const buffer = await upstream.arrayBuffer()
      return new Response(buffer, { status: upstream.status, headers: responseHeaders })
    } catch (err) {
      return c.json({ error: 'Opencode 连接失败', detail: String(err) }, 502)
    }
  })

  app.post('/__api/opencode/restart', async (c) => {
    try {
      const result = await deps.restart()
      return c.json(result, result.ok ? 200 : 500)
    } catch (err) {
      return c.json({ ok: false, error: String(err) }, 500)
    }
  })

  return app
}
