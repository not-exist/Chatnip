import { useState, useEffect, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Card, CardBody } from '@heroui/card'
import { Button } from '@heroui/button'
import { Divider } from '@heroui/divider'
import { Spinner } from '@heroui/spinner'
import { Select, SelectItem } from '@heroui/select'
import { FiArrowLeft, FiInfo, FiSliders, FiZap } from 'react-icons/fi'
import toast from 'react-hot-toast'
import AnalysisFeatureSelector from '@/components/AnalysisFeatureSelector'
import SectionHeader from '@/components/SectionHeader'
import DateRangePicker from '@/components/DateRangePicker'
import { useAppSelector, useAppDispatch } from '@/store'
import { setDefaultModel } from '@/store/settingsSlice'
import { useNapcatApi } from '@/hooks/useNapcatApi'
import { useOpencode } from '@/hooks/useOpencode'
import { buildUserPrompt, getSystemPrompt, getFeaturePrompts, formatMessages } from '@/prompts/analysis'
import { listProviders } from '@/api/opencode'
import type { FilePartInput } from '@/api/opencode'
import { writeChatFile, cleanupChatHistory } from '@/api/fileWriter'
import type { ChatType, ProviderInfo, ModelInfo } from '@/types'
import type { DateRange } from 'react-day-picker'

const BATCH_SIZE = 1000
const MAX_BATCHES = 20

export default function NewAnalysisPage() {
  const { type, id } = useParams<{ type: ChatType; id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const chatId = Number(id)
  const chatName = (location.state as { chatName?: string })?.chatName || `${type} ${id}`

  const { defaultFeatures, defaultModel } = useAppSelector((s) => s.settings)
  const { getGroupMsgHistory, getFriendMsgHistory } = useNapcatApi()
  const { createSession, sendPromptWithFiles } = useOpencode()

  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [features, setFeatures] = useState(defaultFeatures)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelInfo | undefined>(defaultModel)

  const chatType = type as ChatType

  useEffect(() => {
    listProviders()
      .then((p) => setProviders(p))
      .catch(() => setProviders([]))
  }, [])

  const currentProvider = providers.find((p) => p.id === selectedModel?.providerID)
  const modelOptions = currentProvider
    ? Object.entries(currentProvider.models).map(([key, m]) => ({
        key,
        name: m.name || key,
      }))
    : []

  const handleModelChange = (modelID: string) => {
    const provider = providers.find((p) => p.id === selectedModel?.providerID)
    if (!provider && providers.length > 0) {
      const firstProvider = providers[0]
      const model = firstProvider.models[modelID]
      if (model) {
        const info: ModelInfo = { providerID: firstProvider.id, modelID, name: model.name || modelID }
        setSelectedModel(info)
        dispatch(setDefaultModel(info))
      }
      return
    }
    if (provider) {
      const model = provider.models[modelID]
      if (model) {
        const info: ModelInfo = { providerID: provider.id, modelID, name: model.name || modelID }
        setSelectedModel(info)
        dispatch(setDefaultModel(info))
      }
    }
  }

  const handleProviderChange = (providerID: string) => {
    const provider = providers.find((p) => p.id === providerID)
    if (provider) {
      const entries = Object.entries(provider.models)
      if (entries.length > 0) {
        const [firstKey, firstModel] = entries[0]
        const info: ModelInfo = {
          providerID: provider.id,
          modelID: firstKey,
          name: firstModel.name || firstKey,
        }
        setSelectedModel(info)
        dispatch(setDefaultModel(info))
      } else {
        setSelectedModel(undefined)
      }
    }
  }

  const handleStartAnalysis = async () => {
    if (!dateRange?.from) {
      toast.error('请先选择日期范围')
      return
    }

    const rangeFrom = new Date(dateRange.from)
    rangeFrom.setHours(0, 0, 0, 0)
    const rangeTo = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from)
    rangeTo.setHours(23, 59, 59, 999)

    setLoading(true)
    setStatus('正在拉取聊天记录...')

    try {
      const allMessages: Array<{
        message_id: number
        user_id: number
        nickname?: string
        time: number
        message: unknown
      }> = []
      let lastMessageSeq: number | undefined
      let batchCount = 0
      let covered = false

      while (batchCount < MAX_BATCHES && !covered) {
        batchCount++
        setStatus(`正在拉取第 ${batchCount} 批聊天记录...`)

        const history =
          chatType === 'group'
            ? await getGroupMsgHistory(chatId, BATCH_SIZE, lastMessageSeq)
            : await getFriendMsgHistory(chatId, BATCH_SIZE, lastMessageSeq)

        const batch = history?.messages || []

        if (batch.length === 0) break

        for (const msg of batch) {
          allMessages.push(msg)
        }

        const oldestInBatch = batch[batch.length - 1]
        if (oldestInBatch.time * 1000 <= rangeFrom.getTime()) {
          covered = true
        } else if (batch.length < BATCH_SIZE) {
          covered = true
        } else {
          lastMessageSeq = oldestInBatch.message_id
        }
      }

      const filtered = allMessages.filter((m) => {
        const t = m.time * 1000
        return t >= rangeFrom.getTime() && t <= rangeTo.getTime()
      })

      if (filtered.length === 0) {
        toast.error('所选日期范围内没有消息')
        setLoading(false)
        return
      }

      if (batchCount >= MAX_BATCHES && !covered) {
        toast('已拉取最近 20000 条消息，可能未完整覆盖所选日期范围', { icon: '⚠️' })
      }

      const dateFrom = rangeFrom.toLocaleDateString('zh-CN')
      const dateTo = rangeTo.toLocaleDateString('zh-CN')

      const groups = new Map<string, typeof filtered>()
      for (const msg of filtered) {
        const dateKey = new Date(msg.time * 1000).toISOString().slice(0, 10)
        if (!groups.has(dateKey)) groups.set(dateKey, [])
        groups.get(dateKey)!.push(msg)
      }

      const sortedDates = [...groups.keys()].sort()
      setStatus(`正在写入 ${sortedDates.length} 个临时文件...`)

      const fileParts = await Promise.all(
        sortedDates.map(async (dateKey) => {
          const msgs = groups.get(dateKey)!
          const text = formatMessages(msgs)
          const filename = `chat-${dateKey}.txt`
          const url = await writeChatFile(filename, text)
          return { type: 'file' as const, mime: 'text/plain', filename, url }
        })
      )

      const userPrompt = buildUserPrompt({
        chatType,
        chatName,
        messageCount: filtered.length,
        features,
        dateFrom,
        dateTo,
        fileCount: sortedDates.length,
      })

      const systemPrompt = getSystemPrompt() + '\n\n' + getFeaturePrompts(features)

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

      const result = await sendPromptWithFiles(sessionId, userPrompt, systemPrompt, fileParts, selectedModel)
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
      cleanupChatHistory().catch(() => {})
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button
          variant="light"
          isIconOnly
          onPress={() => navigate(-1)}
          className="rounded-xl"
        >
          <FiArrowLeft className="text-lg" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">分析配置</h1>
          <p className="text-sm text-default-500 mt-0.5">配置分析参数，开始 AI 分析</p>
        </div>
      </div>

      <Card className="card-enhanced">
        <SectionHeader icon={FiInfo} title="会话信息" variant="primary" />
        <Divider />
        <CardBody className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-default-400 text-xs">类型</span>
              <p className="font-medium mt-0.5">{chatType === 'group' ? '群聊' : '私聊'}</p>
            </div>
            <div>
              <span className="text-default-400 text-xs">名称</span>
              <p className="font-medium mt-0.5 truncate">{chatName}</p>
            </div>
            <div>
              <span className="text-default-400 text-xs">ID</span>
              <p className="font-medium mt-0.5 font-mono text-xs">{chatId}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="card-enhanced">
        <SectionHeader icon={FiSliders} title="分析参数" variant="secondary" />
        <Divider />
        <CardBody className="space-y-6 py-4">
          <div className="space-y-2.5">
            <label className="text-sm font-medium text-default-700">AI 模型</label>
            <div className="flex gap-2">
              <Select
                placeholder="选择 provider"
                selectedKeys={selectedModel?.providerID ? [selectedModel.providerID] : []}
                onSelectionChange={(keys) =>
                  handleProviderChange(Array.from(keys as Set<string>)[0] || '')
                }
                size="sm"
                className="max-w-[200px]"
                isDisabled={providers.length === 0}
                classNames={{ trigger: 'rounded-xl' }}
              >
                {providers.map((p) => (
                  <SelectItem key={p.id}>{p.name}</SelectItem>
                ))}
              </Select>
              {currentProvider && (
                <Select
                  placeholder="选择模型"
                  selectedKeys={selectedModel?.modelID ? [selectedModel.modelID] : []}
                  onSelectionChange={(keys) =>
                    handleModelChange(Array.from(keys as Set<string>)[0] || '')
                  }
                  size="sm"
                  className="max-w-[300px]"
                  classNames={{ trigger: 'rounded-xl' }}
                >
                  {modelOptions.map((m) => (
                    <SelectItem key={m.key}>{m.name}</SelectItem>
                  ))}
                </Select>
              )}
            </div>
            {providers.length === 0 && (
              <p className="text-xs text-default-400">未检测到可用模型，将使用 opencode 默认模型</p>
            )}
          </div>

          <div className="space-y-2.5">
            <label className="text-sm font-medium text-default-700">日期范围</label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <p className="text-xs text-default-400">
              选择要分析的聊天记录日期范围，将拉取该范围内所有消息
            </p>
          </div>

          <AnalysisFeatureSelector selected={features} onChange={setFeatures} />
        </CardBody>
      </Card>

      <Button
        color="primary"
        size="lg"
        className="w-full h-12 rounded-2xl font-semibold text-base bg-gradient-to-r from-primary-400 to-primary-500 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-px"
        isLoading={loading}
        isDisabled={!dateRange?.from}
        onPress={handleStartAnalysis}
        startContent={!loading ? <FiZap /> : undefined}
      >
        {loading ? status : '开始分析'}
      </Button>

      {loading && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Spinner size="lg" color="primary" />
          <p className="text-default-500 text-sm">{status}</p>
        </div>
      )}
    </div>
  )
}
