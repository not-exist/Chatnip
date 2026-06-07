import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { Spinner } from '@heroui/spinner'
import { FiRefreshCw } from 'react-icons/fi'
import toast from 'react-hot-toast'
import SessionCard from '@/components/SessionCard'
import { useOpencode } from '@/hooks/useOpencode'
import type { SessionInfo } from '@/types'

export default function SessionsPage() {
  const navigate = useNavigate()
  const { listSessions, deleteSession } = useOpencode()
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listSessions()
      setSessions(result || [])
    } catch {
      toast.error('无法获取会话列表，请检查 opencode 连接')
    } finally {
      setLoading(false)
    }
  }, [listSessions])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const handleDelete = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      toast.success('已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const filtered = sessions.filter(
    (s) =>
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.chatName.toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" color="primary" label="加载中..." />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">分析历史</h1>
        <Button
          variant="flat"
          size="sm"
          startContent={<FiRefreshCw />}
          onPress={loadSessions}
        >
          刷新
        </Button>
      </div>

      <Input
        placeholder="搜索分析记录..."
        value={search}
        onValueChange={setSearch}
        isClearable
        className="max-w-md"
      />

      {filtered.length === 0 && (
        <p className="text-default-500 text-center py-12">
          {sessions.length === 0
            ? '暂无分析记录，去选择一个会话开始分析吧'
            : '无匹配结果'}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onView={() => navigate(`/sessions/${session.id}`, { state: { chatName: session.chatName } })}
            onDelete={() => handleDelete(session.id)}
          />
        ))}
      </div>
    </div>
  )
}
