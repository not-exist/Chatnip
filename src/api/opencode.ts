import type { ProviderInfo, ModelInfo } from '@/types'

export interface FilePartInput {
  type: 'file'
  mime: string
  filename?: string
  url: string
}

const PROXY_BASE = '/api/opencode'

let sdkPromise: ReturnType<typeof import('@opencode-ai/sdk/client').createOpencodeClient> | null = null

async function getClient() {
  if (sdkPromise) return sdkPromise
  const { createOpencodeClient } = await import('@opencode-ai/sdk/client')
  sdkPromise = createOpencodeClient({
    baseUrl: PROXY_BASE,
    throwOnError: true,
  })
  Promise.resolve(sdkPromise).catch(() => { sdkPromise = null })
  return sdkPromise
}

export async function createSession(title: string) {
  const client = await getClient()
  const result = await client.session.create({ body: { title } })
  return result.data!
}

export async function deleteSession(id: string) {
  const client = await getClient()
  await client.session.delete({ path: { id } })
}

export async function listSessions() {
  const client = await getClient()
  const result = await client.session.list()
  return result.data ?? []
}

export async function listProviders(): Promise<ProviderInfo[]> {
  const client = await getClient()
  const result = await client.provider.list()
  if (result.data?.all) {
    return result.data.all.map((p) => ({
      id: p.id,
      name: p.name,
      models: p.models,
    }))
  }
  return []
}

export async function getSessionMessages(id: string) {
  const client = await getClient()
  const result = await client.session.messages({ path: { id } })
  return result.data ?? []
}

export async function sendPrompt(
  sessionId: string,
  text: string,
  model?: ModelInfo,
) {
  const client = await getClient()
  const result = await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [{ type: 'text' as const, text }],
      ...(model ? { model: { providerID: model.providerID, modelID: model.modelID } } : {}),
    },
  })
  return result.data!
}

export async function sendPromptWithFiles(
  sessionId: string,
  text: string,
  system: string,
  files: FilePartInput[],
  model?: ModelInfo,
) {
  const client = await getClient()
  const result = await client.session.prompt({
    path: { id: sessionId },
    body: {
      system,
      parts: [
        { type: 'text' as const, text },
        ...files.map((f) => ({ type: 'file' as const, mime: f.mime, filename: f.filename, url: f.url })),
      ],
      ...(model ? { model: { providerID: model.providerID, modelID: model.modelID } } : {}),
    },
  })
  return result.data!
}

export async function updateSessionTitle(id: string, title: string) {
  const client = await getClient()
  await client.session.update({ path: { id }, body: { title } })
}

export async function testOpencodeConnection(): Promise<boolean> {
  try {
    const client = await getClient()
    await client.provider.list()
    return true
  } catch {
    return false
  }
}

export async function restartOpencodeServer(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/__api/opencode/restart', { method: 'POST' })
    return await res.json()
  } catch {
    return { ok: false, error: '请求失败' }
  }
}
