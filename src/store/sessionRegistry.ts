import type { SessionInfo } from '@/types'
import { saveAppState } from '@/api/appState'

const STORAGE_KEY = 'chatnip-sessions'

function isValidSessionRecord(v: unknown): v is SessionInfo {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return typeof r.id === 'string' && r.id.length > 0
    && typeof r.title === 'string'
    && (r.chatType === 'group' || r.chatType === 'friend')
    && typeof r.chatId === 'number' && !Number.isNaN(r.chatId)
    && typeof r.chatName === 'string'
    && Array.isArray(r.features) && r.features.every((f) => typeof f === 'string')
    && typeof r.createdAt === 'number' && !Number.isNaN(r.createdAt)
}

export function sanitizeSessions(raw: unknown): Record<string, SessionInfo> {
  if (typeof raw !== 'object' || raw === null) return {}
  const clean: Record<string, SessionInfo> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (isValidSessionRecord(value)) {
      clean[key] = value
    }
  }
  return clean
}

function load(): Record<string, SessionInfo> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return sanitizeSessions(JSON.parse(raw))
    }
  } catch { /* ignore */ }
  return {}
}

function persist(records: Record<string, SessionInfo>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch { /* storage may be unavailable */ }
  saveAppState('sessions', records).catch(() => {})
}

export function registerSession(record: SessionInfo) {
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

export function getRegisteredSessions(): Record<string, SessionInfo> {
  return load()
}

export function getRegisteredSession(id: string): SessionInfo | null {
  return load()[id] ?? null
}
