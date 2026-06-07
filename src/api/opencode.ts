import type { OpencodeConfig } from '@/types'

let sdkPromise: ReturnType<typeof import('@opencode-ai/sdk/client').createOpencodeClient> | null = null

async function getClient(config: OpencodeConfig) {
  if (sdkPromise) return sdkPromise
  const { createOpencodeClient } = await import('@opencode-ai/sdk/client')
  sdkPromise = createOpencodeClient({
    baseUrl: `http://${config.host}:${config.port}`,
  })
  return sdkPromise
}

export async function createSession(config: OpencodeConfig, title: string) {
  const client = await getClient(config)
  const result = await client.session.create({ body: { title } })
  return result.data!
}

export async function deleteSession(config: OpencodeConfig, id: string) {
  const client = await getClient(config)
  await client.session.delete({ path: { id } })
}

export async function listSessions(config: OpencodeConfig) {
  const client = await getClient(config)
  const result = await client.session.list()
  return result.data ?? []
}

export async function getSessionMessages(config: OpencodeConfig, id: string) {
  const client = await getClient(config)
  const result = await client.session.messages({ path: { id } })
  return result.data ?? []
}

export async function sendPrompt(
  config: OpencodeConfig,
  sessionId: string,
  text: string,
) {
  const client = await getClient(config)
  const result = await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [{ type: 'text' as const, text }],
    },
  })
  return result.data!
}

export async function updateSessionTitle(
  config: OpencodeConfig,
  id: string,
  title: string,
) {
  const client = await getClient(config)
  await client.session.update({ path: { id }, body: { title } })
}

export async function testOpencodeConnection(config: OpencodeConfig): Promise<boolean> {
  try {
    const client = await getClient(config)
    await client.session.list()
    return true
  } catch {
    return false
  }
}
