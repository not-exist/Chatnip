import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs, Input } from '@heroui/react'
import { FiMessageSquare } from 'react-icons/fi'
import toast from 'react-hot-toast'
import ChatCard from '@/components/ChatCard'
import { useNapcatApi } from '@/hooks/useNapcatApi'
import EmptyState from '@/components/EmptyState'
import type { GroupInfo, FriendInfo, ChatType } from '@/types'

function SkeletonCard() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-200/60 dark:border-white/10">
      <div className="w-11 h-11 rounded-xl skeleton" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 skeleton rounded-sm" />
        <div className="h-3 w-24 skeleton rounded-sm" />
      </div>
      <div className="h-6 w-14 skeleton rounded-full" />
    </div>
  )
}

export default function ChatListPage() {
  const navigate = useNavigate()
  const { getGroupList, getFriendList } = useNapcatApi()
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [friends, setFriends] = useState<FriendInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'group' | 'friend'>('group')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [g, f] = await Promise.all([getGroupList(), getFriendList()])
      setGroups(g)
      setFriends(f)
    } catch {
      toast.error('无法连接到 NapCat，请检查配置')
    } finally {
      setLoading(false)
    }
  }, [getGroupList, getFriendList])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredGroups = groups.filter(
    (g) =>
      !search ||
      g.group_name.toLowerCase().includes(search.toLowerCase()) ||
      String(g.group_id).includes(search),
  )

  const filteredFriends = friends.filter(
    (f) =>
      !search ||
      f.nickname.toLowerCase().includes(search.toLowerCase()) ||
      (f.remark && f.remark.toLowerCase().includes(search.toLowerCase())) ||
      String(f.user_id).includes(search),
  )

  const handleSelect = (type: ChatType, id: number, name: string) => {
    navigate(`/analyze/${type}/${id}`, { state: { chatName: name } })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">会话选择</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">选择一个群聊或好友，开始 AI 分析</p>
      </div>

      <Input
        placeholder="搜索名称或 ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md rounded-xl"
      />

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as 'group' | 'friend')}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="聊天类型">
            <Tabs.Tab id="group">群聊 ({filteredGroups.length})<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="friend">好友 ({filteredFriends.length})<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="group">
          <div className="space-y-3 mt-4">
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            {!loading && filteredGroups.length === 0 && (
              <EmptyState
                icon={FiMessageSquare}
                title={groups.length === 0 ? '暂无群聊' : '无匹配结果'}
                description={groups.length === 0 ? '请检查 NapCat 连接配置' : '尝试修改搜索条件'}
              />
            )}
            {!loading && filteredGroups.map((g) => (
              <ChatCard
                key={g.group_id}
                id={g.group_id}
                name={g.group_name}
                chatType="group"
                memberCount={g.member_count}
                onClick={() => handleSelect('group', g.group_id, g.group_name)}
              />
            ))}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="friend">
          <div className="space-y-3 mt-4">
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            {!loading && filteredFriends.length === 0 && (
              <EmptyState
                icon={FiMessageSquare}
                title={friends.length === 0 ? '暂无好友' : '无匹配结果'}
                description={friends.length === 0 ? '请检查 NapCat 连接配置' : '尝试修改搜索条件'}
              />
            )}
            {!loading && filteredFriends.map((f) => (
              <ChatCard
                key={f.user_id}
                id={f.user_id}
                name={f.remark || f.nickname}
                chatType="friend"
                onClick={() => handleSelect('friend', f.user_id, f.remark || f.nickname)}
              />
            ))}
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
