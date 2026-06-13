import { Card, CardBody } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { FiUsers, FiUser, FiChevronRight } from 'react-icons/fi'
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
      className="w-full hover:bg-default-100 transition-all duration-200 hover:shadow-sm hover:-translate-y-px card-enhanced group"
    >
      <CardBody className="flex flex-row items-center gap-4 py-3.5">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center shadow-sm">
          <Icon className="text-white text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[15px] truncate">{name || `ID: ${id}`}</p>
          <p className="text-xs text-default-400 mt-0.5">
            {chatType === 'group' ? '群聊' : '好友'} · ID: {id}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {chatType === 'group' && memberCount !== undefined && (
            <Chip size="sm" variant="flat" color="primary" className="font-medium">
              {memberCount} 人
            </Chip>
          )}
          <FiChevronRight className="text-default-300 group-hover:text-default-500 transition-colors" />
        </div>
      </CardBody>
    </Card>
  )
}
