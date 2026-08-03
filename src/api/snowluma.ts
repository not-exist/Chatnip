import type {
  GroupInfo,
  FriendInfo,
  GroupMemberInfo,
  NapCatMessageHistory,
} from '@/types'

export async function getGroupList(): Promise<GroupInfo[]> {
  const res = await fetch('/api/snowluma/group_list')
  if (!res.ok) throw new Error('SnowLuma 连接失败')
  const data = await res.json()
  return data ?? []
}

export async function getFriendList(): Promise<FriendInfo[]> {
  const res = await fetch('/api/snowluma/friend_list')
  if (!res.ok) throw new Error('SnowLuma 连接失败')
  const data = await res.json()
  return data ?? []
}

export async function getGroupMsgHistory(
  groupId: number,
  count: number,
  messageSeq?: number,
): Promise<NapCatMessageHistory> {
  const body: Record<string, unknown> = { group_id: groupId, count }
  if (messageSeq !== undefined) {
    body.message_seq = messageSeq
  }
  const res = await fetch('/api/snowluma/group_msg_history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('SnowLuma 连接失败')
  const data = await res.json()
  return data ?? { messages: [] }
}

export async function getFriendMsgHistory(
  userId: number,
  count: number,
  messageSeq?: number,
): Promise<NapCatMessageHistory> {
  const body: Record<string, unknown> = { user_id: userId, count }
  if (messageSeq !== undefined) {
    body.message_seq = messageSeq
  }
  const res = await fetch('/api/snowluma/friend_msg_history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('SnowLuma 连接失败')
  const data = await res.json()
  return data ?? { messages: [] }
}

export async function getGroupMemberList(groupId: number): Promise<GroupMemberInfo[]> {
  const res = await fetch(`/api/snowluma/group_member_list?group_id=${groupId}`)
  if (!res.ok) throw new Error('SnowLuma 连接失败')
  const data = await res.json()
  return data ?? []
}

export async function testConnection(): Promise<boolean> {
  try {
    const res = await fetch('/api/snowluma/test')
    if (!res.ok) return false
    const data = await res.json()
    return data.ok === true
  } catch {
    return false
  }
}
