export async function saveAppState(key: string, data: unknown): Promise<void> {
  await fetch('/__api/app-state/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, data }),
  })
}

export async function loadAppState(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch('/__api/app-state/load')
    return await res.json()
  } catch {
    return {}
  }
}
