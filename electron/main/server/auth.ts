import { timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

export const AUTH_HEADER = 'x-chatnip-token'
export const MAX_BODY_BYTES = 32 * 1024 * 1024

const ALLOWED_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function hostnameOf(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null
  if (hostHeader.startsWith('[')) {
    const end = hostHeader.indexOf(']')
    return end === -1 ? null : hostHeader.slice(0, end + 1)
  }
  return hostHeader.split(':')[0] ?? null
}

export function createAuthMiddleware(token: string, allowedOrigins: string[]): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header('origin')
    const originAllowed = !origin || allowedOrigins.includes(origin)

    if (originAllowed && origin) {
      c.header('Access-Control-Allow-Origin', origin)
      c.header('Vary', 'Origin')
      c.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
      c.header('Access-Control-Allow-Headers', `content-type,${AUTH_HEADER}`)
      c.header('Access-Control-Max-Age', '600')
    }

    if (c.req.method === 'OPTIONS') {
      return c.body(null, originAllowed ? 204 : 403)
    }

    if (!originAllowed) {
      return c.json({ error: 'forbidden origin' }, 403)
    }

    const hostname = hostnameOf(c.req.header('host'))
    if (!hostname || !ALLOWED_HOSTNAMES.has(hostname)) {
      return c.json({ error: 'forbidden host' }, 403)
    }

    const provided = c.req.header(AUTH_HEADER) ?? ''
    if (!secureEqual(provided, token)) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    const contentLength = Number(c.req.header('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return c.json({ error: 'payload too large' }, 413)
    }

    await next()
  }
}
