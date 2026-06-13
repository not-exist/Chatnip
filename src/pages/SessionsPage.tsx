import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { FiRefreshCw, FiSearch, FiFileText } from 'react-icons/fi'
import toast from 'react-hot-toast'
import SessionCard from '@/components/SessionCard'
import { useOpencode } from '@/hooks/useOpencode'
import type { SessionInfo } from '@/types'

function SkeletonSession() {
  return (
    <div className="p-5 rounded-xl border border-default-100/60 space-y-3">
      <div className="flex justify-between">
        <div className="h-5 w-48 skeleton rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-16 skeleton rounded-lg" />
          <div className="h-8 w-8 skeleton rounded-lg" />
        </div>
      </div>
      <div className="h-3 w-64 skeleton rounded" />
      <div className="flex gap-2">
        <div className="h-6 w-16 skeleton rounded-full" />
        <div className="h-6 w-20 skeleton rounded-full" />
      </div>
    </div>
  )
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-default-400">
      <div className="w-16 h-16 rounded-2xl bg-default-100 flex items-center justify-center mb-5">
        <FiFileText className="text-3xl opacity-50" />
      </div>
      <p className="text-base font-medium text-default-600 mb-1.5">
        {hasAny ? '无匹配结果' : '暂无分析记录'}
      </p>
      <p className="text-sm">
        {hasAny ? '尝试修改搜索条件' : '去选择一个会话开始分析吧'}
      </p>
    </div>
  )
}

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">分析历史</h1>
          <p className="text-sm text-default-500 mt-1">查看和管理历史分析结果</p>
        </div>
        <Button
          variant="flat"
          size="sm"
          startContent={<FiRefreshCw />}
          onPress={loadSessions}
          className="rounded-xl"
        >
          刷新
        </Button>
      </div>

      <Input
        placeholder="搜索分析记录..."
        value={search}
        onValueChange={setSearch}
        isClearable
        startContent={<FiSearch className="text-default-400" />}
        classNames={{ inputWrapper: 'rounded-xl shadow-sm' }}
        className="max-w-md"
      />

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonSession key={i} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState hasAny={sessions.length > 0} />
      )}

      {!loading && (
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
      )}
    </div>
  )
}
