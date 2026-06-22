import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FiUser, FiCpu } from 'react-icons/fi'
import type { ChatMessage } from '@/types'

const MAX_USER_MESSAGE_LENGTH = 1200

interface ConversationViewProps {
  messages: ChatMessage[]
  hideUserMessages?: boolean
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  const timeStr = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs ${
        isUser
          ? 'bg-gradient-to-br from-primary-400 to-primary-500 text-white'
          : 'bg-default-200 text-default-600'
      }`}>
        {isUser ? <FiUser /> : <FiCpu />}
      </div>

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[78%]`}>
        <div className={`px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bubble-user rounded-2xl rounded-tr-md'
            : 'bubble-ai rounded-2xl rounded-tl-md'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content.length > MAX_USER_MESSAGE_LENGTH ? msg.content.slice(0, MAX_USER_MESSAGE_LENGTH) + '\n...(已截断)' : msg.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-p:my-1
              prose-headings:mt-3 prose-headings:mb-1
              prose-code:bg-default-200 prose-code:px-1 prose-code:rounded-sm
              prose-code:before:content-none prose-code:after:content-none
              prose-table:border-collapse prose-table:w-full prose-table:text-xs
              prose-th:border prose-th:border-default-300 prose-th:bg-default-100 prose-th:px-2 prose-th:py-1.5
              prose-td:border prose-td:border-default-300 prose-td:px-2 prose-td:py-1.5
              prose-blockquote:border-l-primary prose-blockquote:bg-default-50/60 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:not-italic
              prose-li:my-0.5
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {timeStr && (
          <span className="text-[11px] text-default-400 mt-1 px-1">{timeStr}</span>
        )}
      </div>
    </div>
  )
}

export default function ConversationView({ messages, hideUserMessages = false }: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const displayMessages = hideUserMessages
    ? messages.filter((m) => m.role !== 'system' && m.role !== 'user')
    : messages.filter((m) => m.role !== 'system')

  if (displayMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-default-400">
        <FiCpu className="text-4xl mb-4 opacity-40" />
        <p className="text-sm">暂无消息</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {displayMessages.map((msg, i) => (
        <MessageBubble key={i} msg={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
