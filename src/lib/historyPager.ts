import type { NapCatMessage, NapCatMessageHistory } from '@/types'

export interface FetchAllHistoryOptions {
  batchSize: number
  maxBatches: number
  rangeFrom: number
}

export type HistoryStopReason = 'covered' | 'empty' | 'short-batch' | 'anchor-stalled' | 'max-batches'

export interface HistoryFetchResult {
  messages: NapCatMessage[]
  batches: number
  stopReason: HistoryStopReason
}

function oldestOf(batch: NapCatMessage[]): NapCatMessage | undefined {
  let oldest: NapCatMessage | undefined
  for (const message of batch) {
    if (!oldest || message.time < oldest.time) oldest = message
  }
  return oldest
}

/**
 * Pull history until the requested range is covered, the server stops returning
 * data, the anchor stops advancing, or maxBatches is hit.
 *
 * The anchor parameter is the provider's history cursor: NapCat accepts the
 * previous oldest `message_id` as `message_seq`; SnowLuma accepts it as
 * `message_id`. Both are passed through the same callback.
 */
export async function fetchAllHistory(
  fetchPage: (anchor?: number) => Promise<NapCatMessageHistory>,
  options: FetchAllHistoryOptions,
): Promise<HistoryFetchResult> {
  const seen = new Set<number>()
  const messages: NapCatMessage[] = []
  let anchor: number | undefined
  let stopReason: HistoryStopReason = 'max-batches'

  for (let batchIndex = 0; batchIndex < options.maxBatches; batchIndex++) {
    const page = await fetchPage(anchor)
    const batch = page?.messages ?? []
    if (batch.length === 0) {
      stopReason = 'empty'
      return { messages, batches: batchIndex + 1, stopReason }
    }

    let added = 0
    for (const message of batch) {
      if (seen.has(message.message_id)) continue
      seen.add(message.message_id)
      messages.push(message)
      added++
    }

    const oldest = oldestOf(batch)
    if (oldest && oldest.time * 1000 <= options.rangeFrom) {
      stopReason = 'covered'
      return { messages, batches: batchIndex + 1, stopReason }
    }

    // Some servers cap the batch size below the requested size; treat a short
    // batch as the end of available history, but never as success if no anchor
    // advanced.
    if (batch.length < options.batchSize) {
      stopReason = 'short-batch'
      return { messages, batches: batchIndex + 1, stopReason }
    }

    if (added === 0) {
      stopReason = 'anchor-stalled'
      return { messages, batches: batchIndex + 1, stopReason }
    }

    const nextAnchor = oldest?.message_id
    if (nextAnchor === undefined || nextAnchor === anchor) {
      stopReason = 'anchor-stalled'
      return { messages, batches: batchIndex + 1, stopReason }
    }
    anchor = nextAnchor
  }

  return { messages, batches: options.maxBatches, stopReason }
}
