import { Card, CardBody } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Button } from '@heroui/button'
import { FiTrash2, FiMessageCircle, FiClock } from 'react-icons/fi'
import { FEATURE_OPTIONS } from '@/prompts/analysis'
import type { SessionInfo } from '@/types'

interface SessionCardProps {
  session: SessionInfo
  onView: () => void
  onDelete: () => void
}

const featureColorMap = {
  summary: 'primary',
  emotion: 'secondary',
  topic: 'success',
  active: 'warning',
  keyword: 'default',
  relationship: 'danger',
} as const satisfies Record<string, 'primary' | 'secondary' | 'warning' | 'success' | 'danger' | 'default'>

export default function SessionCard({ session, onView, onDelete }: SessionCardProps) {
  const featureLabels = session.features.map((key) => {
    const opt = FEATURE_OPTIONS.find((f) => f.key === key)
    return { key, label: opt?.label || key, color: featureColorMap[key as keyof typeof featureColorMap] || 'default' as const }
  })

  const date = new Date(session.createdAt)

  return (
    <Card className="w-full card-accent card-enhanced">
      <div className="flex items-stretch">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="font-semibold text-base truncate flex-1 mr-4">{session.title}</h3>
            <div className="shrink-0 flex gap-1.5">
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<FiMessageCircle />}
                onPress={onView}
              >
                查看
              </Button>
              <Button
                size="sm"
                variant="light"
                color="danger"
                isIconOnly
                onPress={onDelete}
              >
                <FiTrash2 />
              </Button>
            </div>
          </div>
          <CardBody className="pt-0 pb-4">
            <div className="flex items-center gap-3 text-xs text-default-500 mb-2.5">
              <span className="flex items-center gap-1">
                <FiClock className="text-[11px]" />
                {date.toLocaleDateString('zh-CN')} {date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span>·</span>
              <span>{session.chatType === 'group' ? '群聊' : '好友'}: {session.chatName}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {featureLabels.map(({ key, label, color }) => (
                <Chip key={key} size="sm" variant="flat" color={color} className="font-medium">
                  {label}
                </Chip>
              ))}
            </div>
          </CardBody>
        </div>
      </div>
    </Card>
  )
}
