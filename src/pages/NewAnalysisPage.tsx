import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Button } from '@heroui/button'
import { Slider } from '@heroui/slider'
import { Divider } from '@heroui/divider'
import { Spinner } from '@heroui/spinner'
import { FiArrowLeft } from 'react-icons/fi'
import toast from 'react-hot-toast'
import AnalysisFeatureSelector from '@/components/AnalysisFeatureSelector'
import { useAppSelector } from '@/store'
import { useNapcatApi } from '@/hooks/useNapcatApi'
import { useOpencode } from '@/hooks/useOpencode'
import { buildUserPrompt, getSystemPrompt, getFeaturePrompts, formatMessages } from '@/prompts/analysis'
import type { ChatType } from '@/types'

export default function NewAnalysisPage() {
  const { type, id } = useParams<{ type: ChatType; id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const chatId = Number(id)
  const chatName = (location.state as { chatName?: string })?.chatName || `${type} ${id}`

  const { defaultMessageCount, defaultFeatures } = useAppSelector((s) => s.settings)
  const { getGroupMsgHistory, getFriendMsgHistory } = useNapcatApi()
  const { createSession, sendPrompt } = useOpencode()

  const [messageCount, setMessageCount] = useState(defaultMessageCount)
  const [features, setFeatures] = useState(defaultFeatures)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const chatType = type as ChatType

  const handleStartAnalysis = async () => {
    setLoading(true)
    setStatus('正在拉取聊天记录...')

    try {
      const history =
        chatType === 'group'
          ? await getGroupMsgHistory(chatId, messageCount)
          : await getFriendMsgHistory(chatId, messageCount)

      const messages = history?.messages || []

      if (messages.length === 0) {
        toast.error('未获取到聊天记录')
        setLoading(false)
        return
      }

      const formatted = formatMessages(messages)
      const times = messages.map((m) => m.time)
      const earliestTime = new Date(Math.min(...times) * 1000).toLocaleString('zh-CN')
      const latestTime = new Date(Math.max(...times) * 1000).toLocaleString('zh-CN')

      const userPrompt = buildUserPrompt({
        chatType,
        chatName,
        messageCount: messages.length,
        features,
        earliestTime,
        latestTime,
        formattedMessages: formatted,
      })

      const systemPrompt = getSystemPrompt() + '\n\n' + getFeaturePrompts(features)
      const fullPrompt = `System: ${systemPrompt}\n\n${userPrompt}`

      setStatus('正在创建分析会话...')

      const session = await createSession({
        title: `分析: ${chatName}`,
        chatType,
        chatId,
        chatName,
        features,
      })
      const sessionId = session.id

      setStatus('正在进行 AI 分析，请耐心等待...')

      const result = await sendPrompt(sessionId, fullPrompt)
      const assistantContent = result.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text)
        .join('\n') || ''

      navigate(`/sessions/${sessionId}`, {
        state: {
          chatType,
          chatId,
          chatName,
          features,
          createdAt: Date.now(),
          initialContent: assistantContent,
        },
      })
    } catch (err) {
      toast.error(`分析失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button
          variant="light"
          isIconOnly
          onPress={() => navigate(-1)}
        >
          <FiArrowLeft className="text-lg" />
        </Button>
        <h1 className="text-2xl font-bold">分析配置</h1>
      </div>

      <Card className="card-enhanced">
        <CardHeader>
          <h2 className="text-lg font-semibold">会话信息</h2>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-2">
          <p><span className="text-default-500">类型:</span> {chatType === 'group' ? '群聊' : '私聊'}</p>
          <p><span className="text-default-500">名称:</span> {chatName}</p>
          <p><span className="text-default-500">ID:</span> {chatId}</p>
        </CardBody>
      </Card>

      <Card className="card-enhanced">
        <CardHeader>
          <h2 className="text-lg font-semibold">分析参数</h2>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-6">
          <Slider
            label={`拉取消息条数: ${messageCount}`}
            step={10}
            minValue={10}
            maxValue={500}
            value={messageCount}
            onChange={(v) => setMessageCount(v as number)}
          />
          <AnalysisFeatureSelector selected={features} onChange={setFeatures} />
        </CardBody>
      </Card>

      <Button
        color="primary"
        size="lg"
        className="w-full"
        isLoading={loading}
        onPress={handleStartAnalysis}
      >
        {loading ? status : '开始分析'}
      </Button>

      {loading && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Spinner size="lg" color="primary" />
          <p className="text-default-500">{status}</p>
        </div>
      )}
    </div>
  )
}
