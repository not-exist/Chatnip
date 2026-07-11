import { describe, it, expect } from 'vitest'
import { reconstructSession } from '@/prompts/analysis'
import type { ChatMessage } from '@/types'

const user = (content: string): ChatMessage => ({ role: 'user', content, timestamp: 1 })
const asst = (content: string): ChatMessage => ({ role: 'assistant', content, timestamp: 2 })

describe('reconstructSession', () => {
  it('anchors analysis at the first NON-EMPTY assistant, skipping empty tool/reasoning steps', () => {
    // Real opencode `build` agent shape: several empty assistant steps precede the report.
    const messages: ChatMessage[] = [
      user('分析这个群聊'),
      asst(''), // step-start / tool
      asst(''), // reasoning
      asst(''), // tool
      asst('## 基础总结\n主要讨论了项目进度。'),
    ]

    const r = reconstructSession(messages, true)

    expect(r.isAnalysis).toBe(true)
    expect(r.analysisContent).toContain('## 基础总结')
    expect(r.followUpMessages).toHaveLength(0)
  })

  it('splits analysis from a follow-up round, dropping empty steps in both turns', () => {
    const messages: ChatMessage[] = [
      user('分析这个群聊'),
      asst(''),
      asst(''),
      asst('## 基础总结\n项目进度汇报。'),
      user('会议是关于什么的？'),
      asst(''), // follow-up tool step
      asst('会议是关于项目进度的。'),
    ]

    const r = reconstructSession(messages, true)

    expect(r.isAnalysis).toBe(true)
    expect(r.analysisContent).toContain('## 基础总结')
    expect(r.followUpMessages).toHaveLength(2)
    expect(r.followUpMessages[0]).toMatchObject({ role: 'user', content: '会议是关于什么的？' })
    expect(r.followUpMessages[1]).toMatchObject({ role: 'assistant', content: '会议是关于项目进度的。' })
  })

  it('detects an analysis session via ## fallback when not known in advance', () => {
    const messages: ChatMessage[] = [
      user('分析这个群聊'),
      asst(''),
      asst('## 话题聚类\n话题一、话题二。'),
    ]

    const r = reconstructSession(messages, false)

    expect(r.isAnalysis).toBe(true)
    expect(r.analysisContent).toContain('## 话题聚类')
  })

  it('treats a plain conversation (no ## heading) as non-analysis', () => {
    const messages: ChatMessage[] = [
      user('你好'),
      asst('你好，有什么可以帮你的？'),
      user('讲个笑话'),
      asst('好的……'),
    ]

    const r = reconstructSession(messages, false)

    expect(r.isAnalysis).toBe(false)
    expect(r.analysisContent).toBe('')
    expect(r.plainMessages).toHaveLength(4)
    expect(r.followUpMessages).toHaveLength(0)
  })

  it('handles the simple case where the first assistant already has content', () => {
    const messages: ChatMessage[] = [
      user('分析'),
      asst('## 基础总结\n内容。'),
      user('追问'),
      asst('回复。'),
    ]

    const r = reconstructSession(messages, true)

    expect(r.analysisContent).toContain('## 基础总结')
    expect(r.followUpMessages.map((m) => m.content)).toEqual(['追问', '回复。'])
  })

  it('returns a non-analysis empty result when there is no assistant message at all', () => {
    const messages: ChatMessage[] = [user('分析这个群聊')]

    const r = reconstructSession(messages, true)

    expect(r.isAnalysis).toBe(false)
    expect(r.analysisContent).toBe('')
    expect(r.plainMessages).toHaveLength(1)
  })
})
