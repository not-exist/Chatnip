import { Card, CardBody, CardHeader } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Button } from '@heroui/button'
import { FiTrash2, FiMessageCircle } from 'react-icons/fi'
import { FEATURE_OPTIONS } from '@/prompts/analysis'
import type { SessionInfo } from '@/types'

interface SessionCardProps {
  session: SessionInfo
  onView: () => void
  onDelete: () => void
}

export default function SessionCard({ session, onView, onDelete }: SessionCardProps) {
  const featureLabels = session.features.map((key) => {
    const opt = FEATURE_OPTIONS.find((f) => f.key === key)
    return opt?.label || key
  })

  const date = new Date(session.createdAt).toLocaleString('zh-CN')

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col items-start gap-2">
        <div className="flex items-center justify-between w-full">
          <h3 className="font-semibold text-lg truncate flex-1 mr-4">{session.title}</h3>
          <div className="flex-shrink-0 flex gap-2">
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
              variant="flat"
              color="danger"
              isIconOnly
              onPress={onDelete}
            >
              <FiTrash2 />
            </Button>
          </div>
        </div>
        <p className="text-sm text-default-500">{date}</p>
      </CardHeader>
      <CardBody>
        <div className="flex items-center gap-2 text-sm text-default-500 mb-2">
          <span>{session.chatType === 'group' ? '群聊' : '好友'}: {session.chatName}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {featureLabels.map((label) => (
            <Chip key={label} size="sm" variant="flat" color="secondary">
              {label}
            </Chip>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
