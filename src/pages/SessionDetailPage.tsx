import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@heroui/button'
import { Divider } from '@heroui/divider'
import { Spinner } from '@heroui/spinner'
import { Chip } from '@heroui/chip'
import { FiArrowLeft, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import toast from 'react-hot-toast'
import DimensionCard from '@/components/DimensionCard'
import ConversationView from '@/components/ConversationView'
import ChatInput from '@/components/ChatInput'
import { useOpencode } from '@/hooks/useOpencode'
import { useAppSelector } from '@/store'
import { parseDimensions } from '@/prompts/analysis'
import type { ChatMessage } from '@/types'

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const sessionId = id!

  const initialContent =
    (location.state as { initialContent?: string })?.initialContent || ''
  const chatName =
    (location.state as { chatName?: string })?.chatName || ''

  const isInitialAnalysis = !!initialContent
  const dimensions = useMemo(
    () => (initialContent ? parseDimensions(initialContent) : []),
    [initialContent],
  )

  const defaultModel = useAppSelector((s) => s.settings.defaultModel)

  const { getMessages, sendPrompt } = useOpencode()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [followUpMessages, setFollowUpMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(isInitialAnalysis ? false : true)
  const [showFollowUpHistory, setShowFollowUpHistory] = useState(false)

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const sendingRef = useRef(false)

  const loadFromOpencode = useCallback(async () => {
    try {
      const result = await getMessages(sessionId)
      if (result && result.length > 0) {
        const msgs: ChatMessage[] = result.map((m) => {
          const text =
            m.parts
              ?.filter((p) => p.type === 'text')
              .map((p) => (p as { text: string }).text)
              .join('\n') || ''
          return {
            role: (m.info.role as ChatMessage['role']) || 'assistant',
            content: text,
            timestamp: m.info.time?.created,
          }
        })
        setMessages(msgs)
      }
    } catch {
      toast.error('无法加载会话消息')
    } finally {
      setLoading(false)
    }
  }, [sessionId, getMessages])

  useEffect(() => {
    if (!isInitialAnalysis) {
      loadFromOpencode()
    }
  }, [isInitialAnalysis, loadFromOpencode])

  useEffect(() => {
    return () => {
      cardRefs.current.clear()
    }
  }, [dimensions])

  const scrollToDimension = (key: string) => {
    const el = cardRefs.current.get(key)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSend = async (text: string) => {
    if (sendingRef.current) return

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() }

    if (isInitialAnalysis) {
      setFollowUpMessages((prev) => [...prev, userMsg])
      setShowFollowUpHistory(true)
    } else {
      setMessages((prev) => [...prev, userMsg])
    }

    sendingRef.current = true
    setSending(true)

    try {
      const result = await sendPrompt(sessionId, text, defaultModel)
      const assistantText =
        result.parts
          ?.filter((p) => p.type === 'text')
          .map((p) => (p as { text: string }).text)
          .join('\n') || ''

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: assistantText,
        timestamp: Date.now(),
      }

      if (isInitialAnalysis) {
        setFollowUpMessages((prev) => [...prev, assistantMsg])
      } else {
        setMessages((prev) => [...prev, assistantMsg])
      }
    } catch {
      toast.error('发送失败')
      if (isInitialAnalysis) {
        setFollowUpMessages((prev) => prev.slice(0, -1))
      } else {
        setMessages((prev) => prev.slice(0, -1))
      }
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Spinner size="lg" color="primary" />
        <p className="text-sm text-default-500">加载会话消息...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="light"
          isIconOnly
          onPress={() => navigate('/sessions')}
          className="rounded-xl"
        >
          <FiArrowLeft className="text-lg" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">
            {chatName ? `分析: ${chatName}` : '分析结果'}
          </h1>
          {isInitialAnalysis && (
            <p className="text-sm text-default-500">可在下方追问更多细节</p>
          )}
        </div>
      </div>

      <Divider />

      {/* Initial Analysis: Dimension Cards View */}
      {isInitialAnalysis && dimensions.length > 0 && (
        <>
          {/* Dimension quick navigation chips */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dimensions.map((dim) => (
              <button
                key={dim.key}
                type="button"
                onClick={() => scrollToDimension(dim.key)}
                className="shrink-0"
              >
                <Chip
                  size="sm"
                  variant="flat"
                  className="cursor-pointer font-medium"
                >
                  {dim.label}
                </Chip>
              </button>
            ))}
          </div>

          {/* Dimension cards grid */}
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

      {/* History Mode: Conversation View */}
      {!isInitialAnalysis && (
        <div className="min-h-[300px]">
          <ConversationView messages={messages} />
        </div>
      )}

      {/* Follow-up section */}
      <div className="sticky bottom-0 bg-background/85 backdrop-blur-md py-4 -mx-4 px-4 border-t border-default-100 space-y-4">
        {isInitialAnalysis && (
          <div className="flex items-center gap-3">
            <Divider className="flex-1" />
            <span className="text-xs text-default-400 font-medium shrink-0">
              追问
            </span>
            <Divider className="flex-1" />
          </div>
        )}

        <ChatInput
          onSend={handleSend}
          disabled={sending}
          placeholder={
            isInitialAnalysis ? '输入更多分析需求...' : '追问更多分析细节...'
          }
        />

        {/* Follow-up history (initial analysis mode) */}
        {isInitialAnalysis && followUpMessages.length > 0 && (
          <div>
            <Button
              variant="light"
              size="sm"
              className="text-xs text-default-500 mb-2"
              onPress={() => setShowFollowUpHistory((prev) => !prev)}
              startContent={
                showFollowUpHistory ? (
                  <FiChevronUp />
                ) : (
                  <FiChevronDown />
                )
              }
            >
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
