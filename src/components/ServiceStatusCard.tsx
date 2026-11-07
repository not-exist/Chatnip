import { useEffect, useState } from 'react'
import { Button, Card, Separator, Chip } from '@heroui/react'
import toast from 'react-hot-toast'
import { FiActivity, FiDownload, FiExternalLink, FiRefreshCw } from 'react-icons/fi'
import SectionHeader from '@/components/SectionHeader'
import { getBridge, type ServiceStatusPayload } from '@/api/runtime'

const EMPTY: ServiceStatusPayload = {
  opencode: { state: 'unknown' },
  qq: { installed: false, state: 'unknown', baseUrl: '', webUiUrl: '' },
}

function stateLabel(state: string): string {
  switch (state) {
    case 'ready': return '运行中'
    case 'starting': return '启动中'
    case 'installing': return '安装中'
    case 'error': return '错误'
    case 'stopped': return '已停止'
    default: return '未知'
  }
}

function stateColor(state: string): 'success' | 'warning' | 'danger' | 'default' {
  if (state === 'ready') return 'success'
  if (state === 'error') return 'danger'
  if (state === 'starting' || state === 'installing') return 'warning'
  return 'default'
}

export default function ServiceStatusCard() {
  const bridge = getBridge()
  const [status, setStatus] = useState<ServiceStatusPayload>(EMPTY)

  useEffect(() => {
    if (!bridge) return
    let alive = true
    bridge.getServiceStatus().then((next) => {
      if (alive) setStatus(next)
    }).catch(() => {})
    const off = bridge.onServiceStatus((next) => setStatus(next))
    return () => {
      alive = false
      off()
    }
  }, [bridge])

  if (!bridge) {
    return (
      <Card className="border border-gray-200/60 dark:border-white/10 shadow-sm">
        <SectionHeader icon={FiActivity} title="服务状态" variant="default" />
        <Separator />
        <Card.Content className="py-4">
          <p className="text-sm text-gray-500">
            当前为 Web 开发模式：Opencode / NapCat 由 `npm run dev` 与外部服务管理。
          </p>
        </Card.Content>
      </Card>
    )
  }

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    const result = await action()
    if (result.ok) toast.success(success)
    else toast.error(result.error || '操作失败')
  }

  return (
    <Card className="border border-gray-200/60 dark:border-white/10 shadow-sm">
      <SectionHeader icon={FiActivity} title="服务状态" variant="default" />
      <Separator />
      <Card.Content className="space-y-4 py-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium">Opencode</p>
            <p className="text-xs text-gray-500">
              {status.opencode.version ? `v${status.opencode.version}` : '未安装'}
              {status.opencode.port ? ` · 端口 ${status.opencode.port}` : ''}
              {status.opencode.error ? ` · ${status.opencode.error}` : ''}
            </p>
          </div>
          <Chip size="sm" variant="tertiary" color={stateColor(status.opencode.state)}>
            {stateLabel(status.opencode.state)}
          </Chip>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium">NapCat</p>
            <p className="text-xs text-gray-500">
              {status.qq.installed ? '已检测到安装' : '未检测到安装'} · {status.qq.baseUrl || '未配置'}
              {status.qq.error ? ` · ${status.qq.error}` : ''}
            </p>
          </div>
          <Chip size="sm" variant="tertiary" color={stateColor(status.qq.state)}>
            {stateLabel(status.qq.state)}
          </Chip>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => run(() => bridge.installOpencode(), 'Opencode 安装完成')}
          >
            <FiDownload className="mr-1.5" />安装 / 修复 Opencode
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => run(() => bridge.restartOpencode(), 'Opencode 已重启')}
          >
            <FiRefreshCw className="mr-1.5" />重启 Opencode
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => run(() => bridge.openQqWebUi(), '已打开 NapCat WebUI')}
          >
            <FiExternalLink className="mr-1.5" />打开 NapCat WebUI
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => { void bridge.openQqInstallGuide() }}
          >
            安装 NapCat
          </Button>
        </div>
      </Card.Content>
    </Card>
  )
}
