import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Button, Separator, Spinner, Chip } from '@heroui/react'
import { FiArrowLeft, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import toast from 'react-hot-toast'
import DimensionCard from '@/components/DimensionCard'
import ConversationView from '@/components/ConversationView'
import ChatInput from '@/components/ChatInput'
import { useOpencode } from '@/hooks/useOpencode'
import { useAppSelector } from '@/store'
import { getRegisteredSession } from '@/store/sessionRegistry'
import { parseDimensions, reconstructSession } from '@/prompts/analysis'
import type { ChatMessage } from '@/types'

/** Concatenate the text of every `text` part of an opencode message. */
function extractText(parts?: Array<{ type: string; text?: string }>): string {
  return (
    parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text ?? '')
      .join('\n') || ''
  )
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const sessionId = id!

  const [analysisContent, setAnalysisContent] = useState(
    (location.state as { initialContent?: string })?.initialContent || ''
  )
  const [chatName, setChatName] = useState(
    (location.state as { chatName?: string })?.chatName ||
    getRegisteredSession(sessionId)?.chatName ||
    ''
  )
  const [serverDetectedAnalysis, setServerDetectedAnalysis] = useState(false)
  const registered = getRegisteredSession(sessionId)
  const isAnalysisFromRegistry = !!(registered?.features?.length)
  const isAnalysisSession = isAnalysisFromRegistry || !!analysisContent || serverDetectedAnalysis
  const dimensions = useMemo(
    () => (analysisContent ? parseDimensions(analysisContent) : []),
    [analysisContent],
  )

  const defaultModel = useAppSelector((s) => s.settings.defaultModel)

  const { getMessages, sendPrompt } = useOpencode()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [followUpMessages, setFollowUpMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(!analysisContent)
  const [showFollowUpHistory, setShowFollowUpHistory] = useState(false)

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const sendingRef = useRef(false)

  // The refs below mirror render-derived state so `loadFromOpencode` (a
  // useCallback) can read the latest values WITHOUT listing them as deps.
  // Depending on the state directly would rebuild the callback on every
  // keystroke, re-run the mount effect, and refetch in a loop. Each mirror is
  // reassigned on the line right after its useRef, so it always tracks render.
  //
  // `hasInteractedRef` is the exception — a latch, not a mirror. Once the user
  // sends a follow-up it stays true so a late-resolving initial load can't
  // clobber the optimistic state with a stale server snapshot. It is lifted
  // again only when a failed send rolls the list back to empty (see handleSend).
  const hasInteractedRef = useRef(false)
  const isAnalysisSessionRef = useRef(isAnalysisSession)
  isAnalysisSessionRef.current = isAnalysisSession
  const analysisContentRef = useRef(analysisContent)
  analysisContentRef.current = analysisContent
  const chatNameRef = useRef(chatName)
  chatNameRef.current = chatName
  const isAnalysisFromRegistryRef = useRef(isAnalysisFromRegistry)
  isAnalysisFromRegistryRef.current = isAnalysisFromRegistry
  const registeredRef = useRef(registered)
  registeredRef.current = registered

  const loadFromOpencode = useCallback(async () => {
    try {
      const result = await getMessages(sessionId)
      if (!result || result.length === 0) {
        setLoading(false)
        return
      }

      // Race guard: if the user already sent a follow-up while this initial
      // load was in flight, its stale snapshot must not overwrite the live
      // optimistic state.
      if (hasInteractedRef.current) {
        setLoading(false)
        return
      }

      const msgs: ChatMessage[] = result.map((m) => ({
        role: (m.info?.role as ChatMessage['role']) || 'assistant',
        content: extractText(m.parts),
        timestamp: m.info?.time?.created,
      }))

      const knownIsAnalysis =
        isAnalysisSessionRef.current || isAnalysisFromRegistryRef.current
      const { isAnalysis, analysisContent: report, followUpMessages: followUps, plainMessages } =
        reconstructSession(msgs, knownIsAnalysis)

      if (isAnalysis) {
        // Server-detected analysis (## fallback) that the registry/state didn't
        // already know about — propagate so the analysis UI renders.
        if (!knownIsAnalysis) {
          console.warn('[SessionDetail] 通过 ## 特征兜底检测到分析会话')
          setServerDetectedAnalysis(true)
        }
        if (!analysisContentRef.current) {
          setAnalysisContent(report)
        }
        setFollowUpMessages(followUps)
        if (!chatNameRef.current && registeredRef.current?.chatName) {
          setChatName(registeredRef.current.chatName)
        }
      } else {
        if (knownIsAnalysis) {
          console.warn('[SessionDetail] 分析会话中未找到有内容的 assistant 消息，按普通对话处理')
        }
        setMessages(plainMessages)
      }
    } catch (err) {
      console.error('[SessionDetail] 加载会话消息失败', err)
      toast.error('无法加载会话消息')
    } finally {
      setLoading(false)
    }
  }, [sessionId, getMessages])

  useEffect(() => {
    loadFromOpencode()
  }, [loadFromOpencode])

  useEffect(() => {
    const refs = cardRefs.current
    return () => {
      refs.clear()
    }
  }, [dimensions])

  const scrollToDimension = (key: string) => {
    const el = cardRefs.current.get(key)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSend = async (text: string) => {
    if (sendingRef.current) return

    // Mark interaction so a late-resolving initial load won't clobber this.
    hasInteractedRef.current = true
    const setList = isAnalysisSession ? setFollowUpMessages : setMessages
    // Drop a trailing optimistic user message (used to roll back on failure).
    const rollback = () =>
      setList((prev) =>
        prev.length > 0 && prev[prev.length - 1].role === 'user'
          ? prev.slice(0, -1)
          : prev,
      )

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() }
    setList((prev) => [...prev, userMsg])
    if (isAnalysisSession) setShowFollowUpHistory(true)

    sendingRef.current = true
    setSending(true)

    try {
      const result = await sendPrompt(sessionId, text, defaultModel)
      const assistantText = extractText(result.parts).trim()

      // An empty reply means the model emitted only tool/reasoning steps and no
      // text. The prompt (user message) is ALREADY persisted server-side, so we
      // must NOT roll back the optimistic user bubble — doing so would make the
      // question vanish here yet reappear on refresh (client/server divergence).
      // Keep it visible and just surface the failure.
      if (!assistantText) {
        toast.error('未获得回复，请重试')
        return
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: assistantText,
        timestamp: Date.now(),
      }
      setList((prev) => [...prev, assistantMsg])
    } catch (err) {
      // The request threw before the turn was accepted; the optimistic user
      // message was not persisted, so rolling it back keeps us consistent.
      console.error('[SessionDetail] 发送失败', err)
      rollback()
      toast.error('发送失败')
      // If the rollback emptied the list, this send left no trace. Lift the
      // race guard so a still-in-flight (or future) initial load can repopulate
      // from the server — otherwise the guard stays latched forever and the
      // page can strand blank despite the server holding the full history.
      setList((prev) => {
        if (prev.length === 0) {
          hasInteractedRef.current = false
        }
        return prev
      })
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Spinner size="lg" color="accent" />
        <p className="text-sm text-gray-500">加载会话消息...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onPress={() => navigate('/sessions')}
          className="rounded-xl"
        >
          <FiArrowLeft className="text-lg" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">
            {chatName ? `分析: ${chatName}` : '分析结果'}
          </h1>
          {isAnalysisSession && (
            <p className="text-sm text-gray-500">可在下方追问更多细节</p>
          )}
        </div>
      </div>

      <Separator />

      {isAnalysisSession && dimensions.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dimensions.map((dim) => (
              <button
                key={dim.key}
                type="button"
                onClick={() => scrollToDimension(dim.key)}
                className="shrink-0"
              >
                <Chip size="sm" variant="tertiary" className="cursor-pointer font-medium">
                  {dim.label}
                </Chip>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {dimensions.map((dim) => (
              <div
                key={dim.key}
                ref={(el) => {
                  if (el) {
                    cardRefs.current.set(dim.key, el)
                  }
                }}
              >
                <DimensionCard dimension={dim} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Render the plain conversation for non-analysis sessions, and also as a
          fallback when a known-analysis session produced no report (messages is
          only populated via that fallback branch) — otherwise the page is blank. */}
      {(!isAnalysisSession || messages.length > 0) && (
        <div className="min-h-[300px]">
          <ConversationView messages={messages} />
        </div>
      )}

      <div className="sticky bottom-0 bg-white/85 dark:bg-gray-950/85 backdrop-blur-md py-4 -mx-4 px-4 border-t border-gray-100 dark:border-white/10 space-y-4">
        {isAnalysisSession && (
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-gray-400 font-medium shrink-0">
              追问
            </span>
            <Separator className="flex-1" />
          </div>
        )}

        <ChatInput
          onSend={handleSend}
          disabled={sending}
          placeholder={
            isAnalysisSession ? '追问更多分析细节...' : '输入消息...'
          }
        />

        {isAnalysisSession && followUpMessages.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 mb-2"
              onPress={() => setShowFollowUpHistory((prev) => !prev)}
            >
              {showFollowUpHistory ? <FiChevronUp className="mr-1" /> : <FiChevronDown className="mr-1" />}
              追问历史 ({followUpMessages.length} 条消息)
            </Button>
            {showFollowUpHistory && (
              <ConversationView messages={followUpMessages} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
