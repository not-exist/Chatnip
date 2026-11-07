import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import type { AppPaths } from '../paths'
import { createAuthMiddleware } from './auth'
import { createAppStateRoutes } from './routes/appState'
import { createFilesRoutes } from './routes/files'
import { createNapcatRoutes, type QqConfig } from './routes/napcat'
import { createOpencodeRoutes, type OpencodeEndpoint } from './routes/opencode'

export interface ServerDeps {
  paths: AppPaths
  token: string
  fetchImpl: typeof fetch
  getQqConfig: () => QqConfig
  saveQqConfig: (config: QqConfig) => Promise<void>
  getOpencodeEndpoint: () => OpencodeEndpoint | null
  restartOpencode: () => Promise<{ ok: boolean; error?: string }>
}

export function createServerApp(deps: ServerDeps): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ ok: true }))

  app.use(
    '/api/*',
    createAuthMiddleware(deps.token, [
      'app://chatnip',
      'null',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]),
  )
  app.use(
    '/__api/*',
    createAuthMiddleware(deps.token, [
      'app://chatnip',
      'null',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]),
  )

  app.route('/', createAppStateRoutes(deps.paths))
  app.route('/', createFilesRoutes(deps.paths))
  app.route(
    '/',
    createNapcatRoutes({
      fetchImpl: deps.fetchImpl,
      getConfig: deps.getQqConfig,
      saveConfig: deps.saveQqConfig,
    }),
  )
  app.route(
    '/',
    createOpencodeRoutes({
      fetchImpl: deps.fetchImpl,
      getEndpoint: deps.getOpencodeEndpoint,
      restart: deps.restartOpencode,
    }),
  )

  return app
}

export interface RunningServer {
  port: number
  close: () => Promise<void>
}

export async function startServer(app: Hono): Promise<RunningServer> {
  const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 })
  if (!server.listening) {
    await once(server, 'listening')
  }
  const address = server.address() as AddressInfo
  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      }),
  }
}
