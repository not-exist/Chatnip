import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SessionDetailPage from '../SessionDetailPage'

// Mock functions must be hoisted so the vi.mock factories can reference them.
const {
  getMessagesMock,
  sendPromptMock,
  getRegisteredSessionMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  getMessagesMock: vi.fn(),
  sendPromptMock: vi.fn(),
  getRegisteredSessionMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}))

// Mock the hook at the module boundary; only getMessages/sendPrompt are exercised.
vi.mock('@/hooks/useOpencode', () => ({
  useOpencode: () => ({
    getMessages: getMessagesMock,
    sendPrompt: sendPromptMock,
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    listSessions: vi.fn(),
    sendPromptWithFiles: vi.fn(),
    listProviders: vi.fn(),
    testConnection: vi.fn(),
  }),
}))

// Control registry to switch between plain and analysis sessions.
vi.mock('@/store/sessionRegistry', () => ({
  getRegisteredSession: getRegisteredSessionMock,
}))

// Avoid pulling in the real Redux store / persistence; component only reads defaultModel.
vi.mock('@/store', () => ({
  useAppSelector: (fn: (s: { settings: { defaultModel: undefined } }) => unknown) =>
    fn({ settings: { defaultModel: undefined } }),
}))

// toast is imported as a default export: `import toast from 'react-hot-toast'`.
vi.mock('react-hot-toast', () => ({
  default: { error: toastErrorMock, success: toastSuccessMock },
}))

/** Build an opencode message with a single text part. */
function msg(role: 'user' | 'assistant', text: string, created = Date.now()) {
  return { info: { role, time: { created } }, parts: [{ type: 'text', text }] }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/sessions/s1']}>
      <Routes>
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Type into the ChatInput and submit via Enter (see ChatInput.tsx onKeyDown). */
function submitFollowUp(text: string, placeholder: string) {
  const input = screen.getByPlaceholderText(placeholder) as HTMLInputElement
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
}

beforeEach(() => {
  getMessagesMock.mockReset()
  sendPromptMock.mockReset()
  getRegisteredSessionMock.mockReset()
  toastErrorMock.mockReset()
  toastSuccessMock.mockReset()
  // default: plain session (no registry entry)
  getRegisteredSessionMock.mockReturnValue(null)
  // silence expected console noise from the error paths under test
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  // jsdom does not implement scrollIntoView, which ConversationView calls in an
  // effect; without this the render tree crashes on mount. (Not in setup.ts.)
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn()
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

const ANALYSIS_PLACEHOLDER = '追问更多分析细节...'
const PLAIN_PLACEHOLDER = '输入消息...'

describe('SessionDetailPage', () => {
  // BUG GUARD: empty-reply divergence — an empty assistant reply must NOT roll
  // back the optimistic follow-up (the prompt is persisted server-side, so
  // rolling back would make the question vanish here yet reappear on refresh).
  it('keeps the optimistic follow-up and warns when the reply is empty', async () => {
    getRegisteredSessionMock.mockReturnValue({ chatName: '测试群', features: ['summary'] })
    getMessagesMock.mockResolvedValue([
      msg('user', '分析这段聊天'),
      msg('assistant', '## 基础总结\n这是分析报告内容'),
    ])
    // Empty reply: only tool/reasoning steps, no text.
    sendPromptMock.mockResolvedValue({ parts: [{ type: 'text', text: '' }] })

    renderPage()
    await screen.findAllByText('基础总结')

    submitFollowUp('我的追问内容', ANALYSIS_PLACEHOLDER)

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('未获得回复，请重试'),
    )
    // The optimistic user follow-up stays visible (history auto-expands on send).
    expect(screen.getByText('我的追问内容')).toBeDefined()
  })

  // BUG GUARD: network error should roll back — a rejected send means the turn
  // was never accepted server-side, so the optimistic user message is removed.
  it('rolls back the optimistic message and warns when the send rejects', async () => {
    // plain session (registry null) so the message renders in the main view
    getMessagesMock.mockResolvedValue([
      msg('user', '第一条'),
      msg('assistant', '第一条回复'),
    ])
    sendPromptMock.mockRejectedValue(new Error('network down'))

    renderPage()
    await screen.findByText('第一条回复')

    submitFollowUp('这条会失败', PLAIN_PLACEHOLDER)

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('发送失败'))
    // Optimistic message removed; the pre-existing conversation is untouched.
    await waitFor(() => expect(screen.queryByText('这条会失败')).toBeNull())
    expect(screen.getByText('第一条回复')).toBeDefined()
  })

  // BUG GUARD (C1): the race guard must LIFT when a failed send rolls the list
  // back to empty. Otherwise `hasInteractedRef` stays latched, a still-in-flight
  // initial load returns early forever, and the page strands blank despite the
  // server holding the full history.
  it('lifts the race guard after a failed send empties the list, so a late load repopulates', async () => {
    // Initial load stays in-flight until we resolve it by hand — simulating a
    // slow fetch that lands AFTER the user already sent (and failed) a follow-up.
    let resolveLoad!: (v: unknown[]) => void
    getMessagesMock.mockReturnValue(
      new Promise((res) => {
        resolveLoad = res as (v: unknown[]) => void
      }),
    )
    sendPromptMock.mockRejectedValue(new Error('network down'))

    // Render as an analysis session via router state so content shows
    // (loading=false) and the ChatInput is usable while the load is pending.
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/sessions/s1',
            state: { initialContent: '## 基础总结\n初始报告', chatName: '测试群' },
          },
        ]}
      >
        <Routes>
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Send a follow-up that fails: guard latches true, then must lift on rollback.
    submitFollowUp('会失败的追问', ANALYSIS_PLACEHOLDER)
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('发送失败'))
    await waitFor(() => expect(screen.queryByText('会失败的追问')).toBeNull())

    // The slow initial load now resolves with real server history. With the
    // guard lifted, its reconstructed follow-ups must render (not be discarded).
    resolveLoad([
      msg('user', '分析这段聊天'),
      msg('assistant', '## 基础总结\n初始报告'),
      msg('user', '服务端的追问'),
      msg('assistant', '服务端的回复'),
    ])

    expect(await screen.findByText('服务端的追问')).toBeDefined()
    expect(await screen.findByText('服务端的回复')).toBeDefined()
  })

  // BUG GUARD: blank-page fallback — a known-analysis session whose assistant
  // messages are all empty steps reconstructs to isAnalysis:false; the page must
  // still render the conversation instead of going blank.
  it('renders the conversation as a fallback when analysis produced no report', async () => {
    getRegisteredSessionMock.mockReturnValue({ chatName: '空群', features: ['summary'] })
    getMessagesMock.mockResolvedValue([
      msg('user', '请分析我的聊天记录'),
      msg('assistant', ''), // empty assistant step only — no report
    ])

    renderPage()

    // Not blank: the user's message text renders via ConversationView.
    expect(await screen.findByText('请分析我的聊天记录')).toBeDefined()
    expect(screen.queryByText('暂无消息')).toBeNull()
  })

  // BUG GUARD (C2): a known-analysis session with no report must DOWNGRADE to a
  // plain thread. Otherwise the old messages sit in the main view while the new
  // follow-up lands in the separate 追问 list — one session split across two
  // disjoint views. After downgrade the input placeholder is the plain one and
  // the follow-up joins the same conversation.
  it('downgrades to a single plain thread (no split) when analysis has no report', async () => {
    getRegisteredSessionMock.mockReturnValue({ chatName: '空群', features: ['summary'] })
    getMessagesMock.mockResolvedValue([
      msg('user', '请分析我的聊天记录'),
      msg('assistant', ''), // empty step only — no report
    ])
    sendPromptMock.mockResolvedValue({ parts: [{ type: 'text', text: '这是回复' }] })

    renderPage()

    // Old message renders; the analysis-only 追问 placeholder is gone (downgraded).
    expect(await screen.findByText('请分析我的聊天记录')).toBeDefined()
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(ANALYSIS_PLACEHOLDER)).toBeNull(),
    )
    const plainInput = screen.getByPlaceholderText(PLAIN_PLACEHOLDER)
    expect(plainInput).toBeDefined()

    // The follow-up joins the SAME thread (main view), not a separate history.
    submitFollowUp('继续', PLAIN_PLACEHOLDER)
    expect(await screen.findByText('这是回复')).toBeDefined()
    // Both the original and the new reply coexist in one conversation.
    expect(screen.getByText('请分析我的聊天记录')).toBeDefined()
    // No 追问历史 toggle appears in a downgraded (plain) session.
    expect(screen.queryByText(/追问历史/)).toBeNull()
  })

  // BUG GUARD (m7): a rejected initial load must clear the spinner and surface a
  // toast — not strand the page on the loading state forever.
  it('shows an error toast and stops loading when the initial fetch rejects', async () => {
    getMessagesMock.mockRejectedValue(new Error('network down'))

    renderPage()

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('无法加载会话消息'),
    )
    // Spinner gone: the loading text is no longer shown.
    await waitFor(() => expect(screen.queryByText('加载会话消息...')).toBeNull())
  })

  // BUG GUARD: plain conversation — no registry, ordinary reply (no `## `),
  // should render as a normal chat with no dimension cards.
  it('renders a plain conversation with no dimension cards', async () => {
    getMessagesMock.mockResolvedValue([
      msg('user', '你好'),
      msg('assistant', '这是一个普通回复'),
    ])

    renderPage()

    expect(await screen.findByText('这是一个普通回复')).toBeDefined()
    // No analysis dimension chip/card should appear.
    expect(screen.queryByText('基础总结')).toBeNull()
  })

  // BUG GUARD: healthy analysis — registry features + a `## ` report render the
  // dimension UI, and the plain ConversationView fallback is NOT the primary view.
  it('renders dimension cards for a healthy analysis session', async () => {
    getRegisteredSessionMock.mockReturnValue({ chatName: '活跃群', features: ['summary'] })
    getMessagesMock.mockResolvedValue([
      msg('user', '分析这段聊天'),
      msg('assistant', '## 基础总结\n讨论了周末出游计划'),
    ])

    renderPage()

    // Dimension label shows in both the chip and the card header.
    const labels = await screen.findAllByText('基础总结')
    expect(labels.length).toBeGreaterThanOrEqual(1)
    // Report body renders in the DimensionCard.
    expect(screen.getByText('讨论了周末出游计划')).toBeDefined()
    // The plain-conversation fallback (empty state) is not shown as primary content.
    expect(screen.queryByText('暂无消息')).toBeNull()
  })
})
