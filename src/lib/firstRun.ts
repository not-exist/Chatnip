const SETUP_KEY = 'chatnip-setup-complete'

export function hasCompletedSetup(): boolean {
  try {
    return localStorage.getItem(SETUP_KEY) === '1'
  } catch {
    return false
  }
}

export function markSetupComplete(): void {
  try {
    localStorage.setItem(SETUP_KEY, '1')
  } catch {
    // Ignore storage failures; the user can still navigate manually.
  }
}
