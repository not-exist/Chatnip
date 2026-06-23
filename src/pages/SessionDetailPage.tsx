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
import { parseDimensions } from '@/prompts/analysis'
import type { ChatMessage } from '@/types'

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
  const isInitialAnalysis = isAnalysisFromRegistry || !!analysisContent || serverDetectedAnalysis
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

  const loadFromOpencode = useCallback(async () => {
    try {
      const result = await getMessages(sessionId)
      if (!result || result.length === 0) {
        setLoading(false)
        return
      }

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

      if (isInitialAnalysis || isAnalysisFromRegistry) {
        const firstAssistantIdx = msgs.findIndex((m) => m.role === 'assistant')
        if (firstAssistantIdx >= 0) {
          if (!analysisContent) {
            setAnalysisContent(msgs[firstAssistantIdx].content)
          }
          setFollowUpMessages(msgs.slice(firstAssistantIdx + 1))
          if (!chatName && registered?.chatName) {
            setChatName(registered.chatName)
          }
        } else {
          console.warn('[SessionDetail] 分析会话中未找到 assistant 消息，按非分析会话处理')
          setMessages(msgs)
        }
      } else {
        // 非分析会话：检查是否需要 `##` 兜底检测
        const firstAssistantIdx = msgs.findIndex((m) => m.role === 'assistant')
        if (firstAssistantIdx >= 0 && msgs[firstAssistantIdx].content.includes('## ')) {
          // 检测到分析内容特征，切换为分析模式
          setServerDetectedAnalysis(true)
          setAnalysisContent(msgs[firstAssistantIdx].content)
          setFollowUpMessages(msgs.slice(firstAssistantIdx + 1))
        } else {
          setMessages(msgs)
        }
      }
    } catch {
      toast.error('无法加载会话消息')
    } finally {
      setLoading(false)
    }
  }, [sessionId, getMessages, isInitialAnalysis, isAnalysisFromRegistry, analysisContent, chatName, registered])

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
        setFollowUpMessages((prev) => {
          if (prev.length === 0) return prev
          if (prev[prev.length - 1].role !== 'user') return prev
          return prev.slice(0, -1)
        })
      } else {
        setMessages((prev) => {
          if (prev.length === 0) return prev
          if (prev[prev.length - 1].role !== 'user') return prev
          return prev.slice(0, -1)
        })
      }
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
          {isInitialAnalysis && (
            <p className="text-sm text-gray-500">可在下方追问更多细节</p>
          )}
        </div>
      </div>

      <Separator />

      {isInitialAnalysis && dimensions.length > 0 && (
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

      {!isInitialAnalysis && (
        <div className="min-h-[300px]">
          <ConversationView messages={messages} />
        </div>
      )}

      <div className="sticky bottom-0 bg-white/85 dark:bg-gray-950/85 backdrop-blur-md py-4 -mx-4 px-4 border-t border-gray-100 dark:border-white/10 space-y-4">
        {isInitialAnalysis && (
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
            isInitialAnalysis ? '输入更多分析需求...' : '追问更多分析细节...'
          }
        />

        {isInitialAnalysis && followUpMessages.length > 0 && (
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
