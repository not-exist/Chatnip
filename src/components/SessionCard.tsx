import { Card, Chip, Button } from '@heroui/react'
import { FiTrash2, FiMessageCircle, FiClock } from 'react-icons/fi'
import { FEATURE_OPTIONS } from '@/prompts/analysis'
import type { SessionInfo } from '@/types'

interface SessionCardProps {
  session: SessionInfo
  onView: () => void
  onDelete: () => void
}

const featureColorMap = {
  summary: 'accent',
  emotion: 'success',
  topic: 'success',
  active: 'warning',
  keyword: 'default',
  relationship: 'danger',
} as const satisfies Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'default'>

export default function SessionCard({ session, onView, onDelete }: SessionCardProps) {
  const featureLabels = session.features.map((key) => {
    const opt = FEATURE_OPTIONS.find((f) => f.key === key)
    return { key, label: opt?.label || key, color: featureColorMap[key as keyof typeof featureColorMap] || ('default' as const) }
  })

  const date = new Date(session.createdAt)

  return (
    <Card className="w-full border border-gray-200/60 dark:border-white/10">
      <Card.Content className="p-5 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base truncate flex-1 mr-4">{session.title}</h3>
          <div className="shrink-0 flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onPress={onView}
            >
              <FiMessageCircle className="mr-1" />
              查看
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={onDelete}
            >
              <FiTrash2 />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2.5">
          <span className="flex items-center gap-1">
            <FiClock className="text-[11px]" />
            {date.toLocaleDateString('zh-CN')} {date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span>·</span>
          <span>{session.chatType === 'group' ? '群聊' : '好友'}: {session.chatName}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {featureLabels.map(({ key, label, color }) => (
            <Chip key={key} size="sm" variant="tertiary" color={color}>
              {label}
            </Chip>
          ))}
        </div>
      </Card.Content>
    </Card>
  )
}
