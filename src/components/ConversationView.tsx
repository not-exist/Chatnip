import { useEffect, useRef } from 'react'
import { Card, CardBody } from '@heroui/card'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

interface ConversationViewProps {
  messages: Message[]
}

export default function ConversationView({ messages }: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const displayMessages = messages.filter((m) => m.role !== 'system')

  return (
    <div className="space-y-4">
      {displayMessages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <Card
            className={`max-w-[80%] ${
              msg.role === 'user'
                ? 'bg-primary/10 border-primary/20'
                : 'bg-default-100'
            }`}
          >
            <CardBody className="py-2 px-4">
              <div className="text-xs text-default-500 mb-1">
                {msg.role === 'user' ? '你' : 'AI'} · {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('zh-CN') : ''}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none
                prose-p:my-1
                prose-code:bg-default-200 prose-code:px-1 prose-code:rounded
                prose-code:before:content-none prose-code:after:content-none
                prose-table:border-collapse prose-table:w-full
                prose-th:border prose-th:border-default-300 prose-th:bg-default-100 prose-th:px-3 prose-th:py-2
                prose-td:border prose-td:border-default-300 prose-td:px-3 prose-td:py-2
                prose-blockquote:border-l-primary prose-blockquote:bg-default-50 prose-blockquote:py-1 prose-blockquote:px-4
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </CardBody>
          </Card>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
