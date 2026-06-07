import { useState, useEffect, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@heroui/button'
import { Divider } from '@heroui/divider'
import { Spinner } from '@heroui/spinner'
import { FiArrowLeft } from 'react-icons/fi'
import toast from 'react-hot-toast'
import AnalysisResultView from '@/components/AnalysisResultView'
import ConversationView from '@/components/ConversationView'
import ChatInput from '@/components/ChatInput'
import { useOpencode } from '@/hooks/useOpencode'
import type { ChatType } from '@/types'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const sessionId = id!

  const initialContent =
    (location.state as { initialContent?: string })?.initialContent || ''
  const chatName =
    (location.state as { chatName?: string })?.chatName || ''

  const { getMessages, sendPrompt } = useOpencode()
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialContent) {
      return [
        { role: 'user', content: '(分析请求)', timestamp: 0 },
        { role: 'assistant', content: initialContent, timestamp: 0 },
      ]
    }
    return []
  })
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(!initialContent)

  const loadFromOpencode = useCallback(async () => {
    try {
      const result = await getMessages(sessionId)
      if (result && result.length > 0) {
        const msgs: Message[] = result.map((m) => {
          const text = m.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => (p as { text: string }).text)
            .join('\n') || ''
          return {
            role: (m.info.role as Message['role']) || 'assistant',
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
    if (!initialContent) {
      loadFromOpencode()
    }
  }, [initialContent, loadFromOpencode])

  const handleSend = async (text: string) => {
    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    try {
      const result = await sendPrompt(sessionId, text)
      const assistantText = result.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text)
        .join('\n') || ''

      const assistantMsg: Message = {
        role: 'assistant',
        content: assistantText,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      toast.error('发送失败')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" color="primary" label="加载会话..." />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="light" isIconOnly onPress={() => navigate('/sessions')}>
          <FiArrowLeft className="text-lg" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">
            {chatName ? `分析: ${chatName}` : '分析结果'}
          </h1>
          <p className="text-sm text-default-500">可在下方追问更多细节</p>
        </div>
      </div>

      <Divider />

      <div className="space-y-6">
        <ConversationView messages={messages} />
      </div>

      <div className="sticky bottom-0 bg-background/80 backdrop-blur py-4 border-t border-default-200">
        <ChatInput
          onSend={handleSend}
          disabled={sending}
          placeholder="追问更多分析细节..."
        />
      </div>
    </div>
  )
}
