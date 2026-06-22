import type { ChatType } from '@/types'
import { saveAppState } from '@/api/appState'

export interface SessionRecord {
  id: string
  title: string
  chatType: ChatType
  chatId: number
  chatName: string
  features: string[]
  createdAt: number
}

const STORAGE_KEY = 'chatnip-sessions'

function isValidSessionRecord(v: unknown): v is SessionRecord {
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

function load(): Record<string, SessionRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        const clean: Record<string, SessionRecord> = {}
        for (const [key, value] of Object.entries(parsed)) {
          if (isValidSessionRecord(value)) {
            clean[key] = value
          }
          // silently drop invalid records
        }
        return clean
      }
    }
  } catch { /* ignore */ }
  return {}
}

function persist(records: Record<string, SessionRecord>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  saveAppState('sessions', records).catch(() => {})
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
