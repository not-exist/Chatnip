import type { ChatType } from '@/types'

export interface SessionRecord {
  id: string
  title: string
  chatType: ChatType
  chatId: number
  chatName: string
  features: string[]
  createdAt: number
}

const STORAGE_KEY = 'qq-aichat-sessions'

function load(): Record<string, SessionRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}

function persist(records: Record<string, SessionRecord>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function registerSession(record: SessionRecord) {
  const records = load()
  records[record.id] = record
  persist(records)
}

export function unregisterSession(id: string) {
  const records = load()
  delete records[id]
  persist(records)
}

export function updateSessionTitle(id: string, title: string) {
  const records = load()
  if (records[id]) {
    records[id].title = title
    persist(records)
  }
}

export function getRegisteredSessions(): Record<string, SessionRecord> {
  return load()
}

export function getRegisteredSession(id: string): SessionRecord | null {
  return load()[id] ?? null
}
