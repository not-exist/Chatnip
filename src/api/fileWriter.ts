export async function writeChatFile(filename: string, content: string): Promise<string> {
  const res = await fetch('/__api/chat-history/write', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename, content }),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `写入文件失败 (${res.status})`)
  }
  return data.url as string
}

export async function cleanupChatHistory(): Promise<void> {
  await fetch('/__api/chat-history/clean', { method: 'DELETE' })
}
