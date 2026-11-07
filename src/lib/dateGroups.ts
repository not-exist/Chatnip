export function localDateKey(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function groupByLocalDate<T extends { time: number }>(messages: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const message of messages) {
    const key = localDateKey(message.time)
    const bucket = groups.get(key)
    if (bucket) bucket.push(message)
    else groups.set(key, [message])
  }
  return groups
}
