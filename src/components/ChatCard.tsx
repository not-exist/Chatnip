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
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200/60 bg-white dark:bg-white/5 dark:border-white/10 cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:shadow-sm hover:-translate-y-px dark:hover:bg-white/10 group"
    >
      <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-rose-400 to-rose-500 flex items-center justify-center shadow-sm">
        <Icon className="text-white text-lg" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[15px] truncate">{name || `ID: ${id}`}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {chatType === 'group' ? '群聊' : '好友'} · ID: {id}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {chatType === 'group' && memberCount !== undefined && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
            {memberCount} 人
          </span>
        )}
        <FiChevronRight className="text-gray-300 group-hover:text-gray-500 transition-colors dark:text-gray-600 dark:group-hover:text-gray-400" />
      </div>
    </div>
  )
}
