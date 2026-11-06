import { describe, expect, it } from 'vitest'
import { groupByLocalDate, localDateKey } from '../dateGroups'

describe('localDateKey', () => {
  it('uses local calendar fields rather than UTC', () => {
    // Construct a local date explicitly; the key must follow the local calendar.
    const localMidnight = new Date(2026, 0, 1, 0, 30, 0)
    expect(localDateKey(localMidnight.getTime() / 1000)).toBe('2026-01-01')
  })

  it('pads month and day', () => {
    const date = new Date(2026, 8, 5, 12, 0, 0)
    expect(localDateKey(date.getTime() / 1000)).toBe('2026-09-05')
  })
})

describe('groupByLocalDate', () => {
  it('groups messages by local date in insertion order', () => {
    const day1 = new Date(2026, 0, 1, 23, 59, 0).getTime() / 1000
    const day2 = new Date(2026, 0, 2, 0, 1, 0).getTime() / 1000
    const groups = groupByLocalDate([
      { time: day1, id: 'a' },
      { time: day1, id: 'b' },
      { time: day2, id: 'c' },
    ])

    expect([...groups.keys()]).toEqual(['2026-01-01', '2026-01-02'])
    expect(groups.get('2026-01-01')?.map((m) => m.id)).toEqual(['a', 'b'])
    expect(groups.get('2026-01-02')?.map((m) => m.id)).toEqual(['c'])
  })
})
