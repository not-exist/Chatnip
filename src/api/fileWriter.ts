import { apiFetch } from '@/api/runtime'

export async function writeChatFile(
  analysisId: string,
  filename: string,
  content: string,
): Promise<string> {
  const res = await apiFetch('/__api/chat-history/write', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ analysisId, filename, content }),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `写入文件失败 (${res.status})`)
  }
  return data.url as string
}

export async function cleanupChatHistory(analysisId: string): Promise<void> {
  await apiFetch('/__api/chat-history/clean', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ analysisId }),
  })
}
