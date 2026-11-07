import { loadAppState } from '@/api/appState'
import { sanitizeSessions } from '@/store/sessionRegistry'

const SETTINGS_KEY = 'chatnip-settings'
const SESSIONS_KEY = 'chatnip-sessions'

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in private mode; app-state remains the fallback.
  }
}

/**
 * Restore settings/sessions from the main-process app-state file before the
 * React store is created. localStorage wins when both exist (it is written on
 * every change); app-state fills the gaps after a cache clear or origin change.
 */
export async function bootstrapState(): Promise<void> {
  try {
    const state = await loadAppState()

    if (state.settings !== undefined && readLocal(SETTINGS_KEY) === null) {
      writeLocal(SETTINGS_KEY, JSON.stringify(state.settings))
    }

    const remote = sanitizeSessions(state.sessions)
    let local: Record<string, unknown> = {}
    const rawLocal = readLocal(SESSIONS_KEY)
    if (rawLocal) {
      try {
        const parsed = JSON.parse(rawLocal)
        if (typeof parsed === 'object' && parsed !== null) {
          local = parsed as Record<string, unknown>
        }
      } catch {
        // ignore corrupt localStorage
      }
    }
    const merged = { ...remote, ...local }
    if (Object.keys(merged).length > 0) {
      writeLocal(SESSIONS_KEY, JSON.stringify(merged))
    }
  } catch {
    // Startup must never be blocked by a state restore failure.
  }
}
