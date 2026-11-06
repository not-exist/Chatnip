import { Button } from '@heroui/react'
import { useNavigate } from 'react-router-dom'
import ServiceStatusCard from '@/components/ServiceStatusCard'
import { getBridge } from '@/api/runtime'
import { markSetupComplete } from '@/lib/firstRun'

export default function SetupPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">首次启动</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Chatnip 需要 Opencode（AI 分析）与 NapCat（QQ 接入）两个本地服务。
        </p>
      </div>

      <ServiceStatusCard />

      <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1.5">
        <p>1. 安装并启动 Opencode（应用会自动下载固定版本）；</p>
        <p>2. 安装 NapCat，打开 WebUI 扫码登录 QQ；</p>
        <p>3. 在 NapCat 中开启 OneBot HTTP 服务（默认 127.0.0.1:3000），把 access token 填入设置页；</p>
        <p>4. 两个服务都显示“运行中”后，进入 Chatnip。</p>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="rounded-2xl"
        onPress={() => {
          markSetupComplete()
          navigate('/chats')
        }}
      >
        进入 Chatnip
      </Button>

      {!getBridge() && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          当前为 Web 开发模式：Opencode / NapCat 由外部进程管理，服务状态仅供参考。
        </p>
      )}
    </div>
  )
}
