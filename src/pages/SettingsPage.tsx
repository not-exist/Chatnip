import { useEffect, useRef, useState } from 'react'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { Divider } from '@heroui/divider'
import { Select, SelectItem } from '@heroui/select'
import { Spinner } from '@heroui/spinner'
import { FiServer, FiCpu, FiSettings, FiCheckCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useAppSelector, useAppDispatch } from '@/store'
import {
  setNapcatConfig,
  setOpencodeConfig,
  setDefaultFeatures,
  setDefaultModel,
} from '@/store/settingsSlice'
import AnalysisFeatureSelector from '@/components/AnalysisFeatureSelector'
import { testConnection as testNapcat } from '@/api/napcat'
import { testOpencodeConnection, listProviders } from '@/api/opencode'
import type { ProviderInfo, ModelInfo } from '@/types'

export default function SettingsPage() {
  const dispatch = useAppDispatch()
  const { napcat, opencode, defaultFeatures, defaultModel } = useAppSelector(
    (s) => s.settings,
  )
  const napcatRef = useRef(napcat)
  napcatRef.current = napcat

  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [providersLoading, setProvidersLoading] = useState(true)
  const [selectedProviderId, setSelectedProviderId] = useState(defaultModel?.providerID || '')
  const [selectedModelId, setSelectedModelId] = useState(defaultModel?.modelID || '')

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/__api/napcat-config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ host: napcat.host, port: napcat.port }),
      }).catch(() => {})
    }, 800)
    return () => clearTimeout(timer)
  }, [napcat.host, napcat.port])

  useEffect(() => {
    listProviders()
      .then((p) => setProviders(p))
      .catch(() => setProviders([]))
      .finally(() => setProvidersLoading(false))
  }, [])

  useEffect(() => {
    if (defaultModel) {
      setSelectedProviderId(defaultModel.providerID)
      setSelectedModelId(defaultModel.modelID)
    }
  }, [defaultModel])

  const currentProvider = providers.find((p) => p.id === selectedProviderId)
  const modelOptions = currentProvider
    ? Object.entries(currentProvider.models).map(([key, m]) => ({
        key,
        name: m.name || key,
      }))
    : []

  const handleProviderChange = (id: string) => {
    setSelectedProviderId(id)
    setSelectedModelId('')
  }

  const handleModelChange = (id: string) => {
    setSelectedModelId(id)
    const provider = providers.find((p) => p.id === selectedProviderId)
    const model = provider?.models[id]
    if (provider && model) {
      dispatch(setDefaultModel({
        providerID: provider.id,
        modelID: id,
        name: model.name || id,
      }))
    }
  }

  const handleTestNapcat = async () => {
    const ok = await testNapcat(napcat)
    if (ok) {
      toast.success('NapCat 连接成功')
    } else {
      toast.error('NapCat 连接失败，请检查配置')
    }
  }

  const handleTestOpencode = async () => {
    const ok = await testOpencodeConnection()
    if (ok) {
      toast.success('Opencode 连接成功')
    } else {
      toast.error('Opencode 连接失败，请确保 opencode serve 已启动')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-default-500 mt-1">配置 NapCat 与 Opencode 连接</p>
      </div>

      <Card className="card-enhanced">
        <CardHeader className="flex gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FiServer className="text-primary" />
          </div>
          <h2 className="text-base font-semibold">NapCat 连接配置</h2>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="主机地址"
              value={napcat.host}
              onValueChange={(v) => dispatch(setNapcatConfig({ host: v }))}
              placeholder="127.0.0.1"
              classNames={{ inputWrapper: 'rounded-xl' }}
            />
            <Input
              label="端口"
              type="number"
              value={String(napcat.port)}
              onValueChange={(v) => dispatch(setNapcatConfig({ port: Number(v) || 3000 }))}
              placeholder="3000"
              classNames={{ inputWrapper: 'rounded-xl' }}
            />
          </div>
          <Input
            label="Token (可选)"
            value={napcat.token}
            onValueChange={(v) => dispatch(setNapcatConfig({ token: v }))}
            placeholder="Bearer token"
            type="password"
            classNames={{ inputWrapper: 'rounded-xl' }}
          />
          <Button
            color="primary"
            variant="flat"
            onPress={handleTestNapcat}
            className="rounded-xl"
            startContent={<FiCheckCircle />}
          >
            测试连接
          </Button>
        </CardBody>
      </Card>

      <Card className="card-enhanced">
        <CardHeader className="flex gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FiCpu className="text-secondary" />
          </div>
          <h2 className="text-base font-semibold">Opencode 连接配置</h2>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-4 py-4">
          <p className="text-sm text-default-500">
            opencode serve 随 Vite 自动启动，通过代理连接（端口 4096）
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="主机地址"
              value={opencode.host}
              onValueChange={(v) => dispatch(setOpencodeConfig({ host: v }))}
              placeholder="127.0.0.1"
              classNames={{ inputWrapper: 'rounded-xl' }}
            />
            <Input
              label="端口"
              type="number"
              value={String(opencode.port)}
              onValueChange={(v) => dispatch(setOpencodeConfig({ port: Number(v) || 4096 }))}
              placeholder="4096"
              classNames={{ inputWrapper: 'rounded-xl' }}
            />
          </div>
          <Button
            color="primary"
            variant="flat"
            onPress={handleTestOpencode}
            className="rounded-xl"
            startContent={<FiCheckCircle />}
          >
            测试连接
          </Button>
        </CardBody>
      </Card>

      <Card className="card-enhanced">
        <CardHeader className="flex gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-default-100 flex items-center justify-center">
            <FiSettings className="text-default-600" />
          </div>
          <h2 className="text-base font-semibold">默认分析设置</h2>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-6 py-4">
          {providersLoading ? (
            <div className="flex items-center gap-2 text-default-500 py-2">
              <Spinner size="sm" />
              <span className="text-sm">正在加载模型列表...</span>
            </div>
          ) : (
            <div className="space-y-4 max-w-md">
              <Select
                label="AI 模型"
                placeholder={providers.length === 0 ? '未检测到可用模型（使用 opencode 默认）' : '选择 provider'}
                selectedKeys={selectedProviderId ? [selectedProviderId] : []}
                onSelectionChange={(keys) => {
                  const id = Array.from(keys as Set<string>)[0] || ''
                  handleProviderChange(id)
                }}
                isDisabled={providers.length === 0}
                classNames={{ trigger: 'rounded-xl' }}
              >
                {providers.map((p) => (
                  <SelectItem key={p.id}>{p.name}</SelectItem>
                ))}
              </Select>
              {currentProvider && (
                <Select
                  label="模型"
                  placeholder="选择具体模型"
                  selectedKeys={selectedModelId ? [selectedModelId] : []}
                  onSelectionChange={(keys) => {
                    const id = Array.from(keys as Set<string>)[0] || ''
                    handleModelChange(id)
                  }}
                  classNames={{ trigger: 'rounded-xl' }}
                >
                  {modelOptions.map((m) => (
                    <SelectItem key={m.key}>{m.name}</SelectItem>
                  ))}
                </Select>
              )}
              {defaultModel && (
                <div className="flex items-center gap-2 text-sm text-default-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  当前默认: {defaultModel.name}
                </div>
              )}
            </div>
          )}
          <Divider />
          <AnalysisFeatureSelector
            selected={defaultFeatures}
            onChange={(f) => dispatch(setDefaultFeatures(f))}
          />
        </CardBody>
      </Card>
    </div>
  )
}
