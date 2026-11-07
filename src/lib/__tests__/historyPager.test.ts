import { describe, expect, it, vi } from 'vitest'
import { fetchAllHistory } from '../historyPager'
import type { NapCatMessage, NapCatMessageHistory } from '@/types'

function msg(message_id: number, time: number): NapCatMessage {
  return { message_id, user_id: 1, time, message: `m${message_id}` }
}

function page(messages: NapCatMessage[]): NapCatMessageHistory {
  return { messages }
}

describe('fetchAllHistory', () => {
  it('advances by the oldest message_id and stops when the range is covered', async () => {
    const pages = [
      page([msg(100, 300), msg(99, 200)]),
      page([msg(98, 100), msg(97, 50)]),
    ]
    const fetchPage = vi.fn(async (anchor?: number) => {
      if (anchor === undefined) return pages[0]
      if (anchor === 99) return pages[1]
      return page([])
    })

    const result = await fetchAllHistory(fetchPage, {
      batchSize: 2,
      maxBatches: 10,
      rangeFrom: 60_000,
    })

    expect(result.stopReason).toBe('covered')
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 99)
    expect(result.messages.map((m) => m.message_id)).toEqual([100, 99, 98, 97])
  })

  it('deduplicates messages across batches', async () => {
    const fetchPage = vi.fn(async (anchor?: number) => {
      if (anchor === undefined) return page([msg(10, 900), msg(9, 800)])
      if (anchor === 9) return page([msg(9, 800), msg(8, 700)])
      return page([])
    })

    const result = await fetchAllHistory(fetchPage, {
      batchSize: 2,
      maxBatches: 10,
      rangeFrom: 0,
    })

    expect(result.messages.map((m) => m.message_id)).toEqual([10, 9, 8])
  })

  it('stops when a short batch signals the end of history', async () => {
    const fetchPage = vi.fn(async () => page([msg(1, 900)]))

    const result = await fetchAllHistory(fetchPage, {
      batchSize: 1000,
      maxBatches: 10,
      rangeFrom: 0,
    })

    expect(result.stopReason).toBe('short-batch')
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('stops when the server ignores the anchor and repeats the same batch', async () => {
    const fetchPage = vi.fn(async () => page([msg(5, 900), msg(4, 800)]))

    const result = await fetchAllHistory(fetchPage, {
      batchSize: 2,
      maxBatches: 10,
      rangeFrom: 0,
    })

    expect(result.stopReason).toBe('anchor-stalled')
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('reports max-batches when the requested depth is never covered', async () => {
    let next = 100
    const fetchPage = vi.fn(async () => {
      const batch = [msg(next, 900 + next), msg(next - 1, 800 + next)]
      next -= 2
      return page(batch)
    })

    const result = await fetchAllHistory(fetchPage, {
      batchSize: 2,
      maxBatches: 3,
      rangeFrom: 0,
    })

    expect(result.stopReason).toBe('max-batches')
    expect(result.batches).toBe(3)
  })
})
