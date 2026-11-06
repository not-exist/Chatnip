import { protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://localhost:*",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

export function registerAppProtocol(rendererDir: string): void {
  const root = resolve(rendererDir)

  protocol.handle('app', async (request) => {
    let url: URL
    try {
      url = new URL(request.url)
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    if (url.host !== 'chatnip') {
      return new Response('Not found', { status: 404 })
    }

    const pathname = decodeURIComponent(url.pathname)
    const isAsset = extname(pathname) !== ''
    const relative = isAsset ? pathname : '/index.html'
    const filePath = resolve(root, '.' + relative)

    if (filePath !== root && !filePath.startsWith(root + sep)) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const data = await readFile(filePath)
      const headers: Record<string, string> = {
        'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      }
      if (relative === '/index.html') {
        headers['content-security-policy'] = CSP
      }
      return new Response(data, { headers })
    } catch {
      if (!isAsset) {
        const fallback = await readFile(resolve(root, 'index.html'))
        return new Response(fallback, {
          headers: {
            'content-type': MIME['.html'],
            'content-security-policy': CSP,
          },
        })
      }
      return new Response('Not found', { status: 404 })
    }
  })
}
