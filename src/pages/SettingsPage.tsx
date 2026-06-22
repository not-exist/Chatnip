import { useEffect, useState } from 'react'
import { Card, Input, Button, Separator, Select, ListBox, Spinner } from '@heroui/react'
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
import SectionHeader from '@/components/SectionHeader'
import { testConnection as testNapcat } from '@/api/napcat'
import { testOpencodeConnection, listProviders, restartOpencodeServer } from '@/api/opencode'
import type { ProviderInfo } from '@/types'

export default function SettingsPage() {
  const dispatch = useAppDispatch()
  const { napcat, opencode, defaultFeatures, defaultModel } = useAppSelector(
    (s) => s.settings,
  )
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
    dispatch(setDefaultModel(undefined))
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">配置 NapCat 与 Opencode 连接</p>
      </div>

      <Card className="card-enhanced">
        <SectionHeader icon={FiServer} title="NapCat 连接配置" variant="primary" />
        <Separator />
        <Card.Content className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">主机地址</label>
              <Input
                value={napcat.host}
                onChange={(e) => dispatch(setNapcatConfig({ host: e.target.value }))}
                placeholder="127.0.0.1"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">端口</label>
              <Input
                type="number"
                value={String(napcat.port)}
                onChange={(e) => dispatch(setNapcatConfig({ port: Number(e.target.value) || 3000 }))}
                placeholder="3000"
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Token (可选)</label>
            <Input
              value={napcat.token}
              onChange={(e) => dispatch(setNapcatConfig({ token: e.target.value }))}
              placeholder="Bearer token"
              type="password"
              className="rounded-xl"
            />
          </div>
          <Button
            variant="tertiary"
            onPress={handleTestNapcat}
            className="rounded-xl"
          >
            <FiCheckCircle className="mr-2" />
            测试连接
          </Button>
        </Card.Content>
      </Card>

      <Card className="card-enhanced">
        <SectionHeader icon={FiCpu} title="Opencode 连接配置" variant="secondary" />
        <Separator />
        <Card.Content className="space-y-4 py-4">
          <p className="text-sm text-gray-500">
            opencode serve 随 Vite 自动启动，通过代理连接（端口 4096）
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">主机地址</label>
              <Input
                value={opencode.host}
                onChange={(e) => dispatch(setOpencodeConfig({ host: e.target.value }))}
                placeholder="127.0.0.1"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">端口</label>
              <Input
                type="number"
                value={String(opencode.port)}
                onChange={(e) => dispatch(setOpencodeConfig({ port: Number(e.target.value) || 4096 }))}
                placeholder="4096"
                className="rounded-xl"
              />
            </div>
          </div>
          <Button
            variant="tertiary"
            onPress={handleTestOpencode}
            className="rounded-xl"
          >
            <FiCheckCircle className="mr-2" />
            测试连接
          </Button>
          <Button
            variant="secondary"
            onPress={async () => {
              const result = await restartOpencodeServer()
              if (result.ok) toast.success('Opencode Server 已重启')
              else toast.error(result.error || '重启失败')
            }}
            className="rounded-xl"
          >
            重启 Server
          </Button>
        </Card.Content>
      </Card>

      <Card className="card-enhanced">
        <SectionHeader icon={FiSettings} title="默认分析设置" variant="default" />
        <Separator />
        <Card.Content className="space-y-6 py-4">
          {providersLoading ? (
            <div className="flex items-center gap-2 text-gray-500 py-2">
              <Spinner size="sm" />
              <span className="text-sm">正在加载模型列表...</span>
            </div>
          ) : (
            <div className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">AI 模型</label>
                <Select
                  placeholder={providers.length === 0 ? '未检测到可用模型（使用 opencode 默认）' : '选择 provider'}
                  value={selectedProviderId}
                  onChange={(key) => handleProviderChange(String(key))}
                  isDisabled={providers.length === 0}
                  className="rounded-xl"
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {providers.map((p) => (
                        <ListBox.Item key={p.id} id={p.id} textValue={p.name}>{p.name}</ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              {currentProvider && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">模型</label>
                  <Select
                    placeholder="选择具体模型"
                    value={selectedModelId}
                    onChange={(key) => handleModelChange(String(key))}
                    className="rounded-xl"
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {modelOptions.map((m) => (
                          <ListBox.Item key={m.key} id={m.key} textValue={m.name}>{m.name}</ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              )}
              {defaultModel && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  当前默认: {defaultModel.name}
                </div>
              )}
            </div>
          )}
          <Separator />
          <AnalysisFeatureSelector
            selected={defaultFeatures}
            onChange={(f) => dispatch(setDefaultFeatures(f))}
          />
        </Card.Content>
      </Card>
    </div>
  )
}
