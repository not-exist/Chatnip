import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs, Tab } from '@heroui/tabs'
import { Input } from '@heroui/input'
import { Spinner } from '@heroui/spinner'
import toast from 'react-hot-toast'
import ChatCard from '@/components/ChatCard'
import { useNapcatApi } from '@/hooks/useNapcatApi'
import type { GroupInfo, FriendInfo, ChatType } from '@/types'

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" color="primary" label="加载中..." />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="搜索名称或 ID..."
        value={search}
        onValueChange={setSearch}
        isClearable
        className="max-w-md"
      />
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as 'group' | 'friend')}
        color="primary"
        variant="underlined"
      >
        <Tab key="group" title={`群聊 (${filteredGroups.length})`}>
          <div className="space-y-3 mt-4">
            {filteredGroups.length === 0 && (
              <p className="text-default-500 text-center py-8">
                {groups.length === 0 ? '暂无群聊，请检查 NapCat 连接' : '无匹配结果'}
              </p>
            )}
            {filteredGroups.map((g) => (
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
        </Tab>
        <Tab key="friend" title={`好友 (${filteredFriends.length})`}>
          <div className="space-y-3 mt-4">
            {filteredFriends.length === 0 && (
              <p className="text-default-500 text-center py-8">
                {friends.length === 0 ? '暂无好友，请检查 NapCat 连接' : '无匹配结果'}
              </p>
            )}
            {filteredFriends.map((f) => (
              <ChatCard
                key={f.user_id}
                id={f.user_id}
                name={f.remark || f.nickname}
                chatType="friend"
                onClick={() => handleSelect('friend', f.user_id, f.remark || f.nickname)}
              />
            ))}
          </div>
        </Tab>
      </Tabs>
    </div>
  )
}
