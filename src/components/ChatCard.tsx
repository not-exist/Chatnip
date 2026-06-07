import { Card, CardBody } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { FiUsers, FiUser } from 'react-icons/fi'
import type { ChatType } from '@/types'

interface ChatCardProps {
  id: number
  name: string
  chatType: ChatType
  memberCount?: number
  onClick: () => void
}

export default function ChatCard({ id, name, chatType, memberCount, onClick }: ChatCardProps) {
  const Icon = chatType === 'group' ? FiUsers : FiUser

  return (
    <Card
      isPressable
      onPress={onClick}
      className="w-full hover:bg-default-100 transition-colors"
    >
      <CardBody className="flex flex-row items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="text-primary text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{name || `ID: ${id}`}</p>
          <p className="text-xs text-default-500">
            {chatType === 'group' ? '群聊' : '好友'} · ID: {id}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {chatType === 'group' && memberCount !== undefined && (
            <Chip size="sm" variant="flat" color="primary">
              <FiUsers className="mr-1" />
              {memberCount}
            </Chip>
          )}
          <Chip size="sm" variant="flat">
            {chatType === 'group' ? '群' : '友'}
          </Chip>
        </div>
      </CardBody>
    </Card>
  )
}
