import axios, { type AxiosInstance } from 'axios'
import type {
  NapCatConfig,
  GroupInfo,
  FriendInfo,
  GroupMemberInfo,
  NapCatMessageHistory,
} from '@/types'

function createClient(config: NapCatConfig): AxiosInstance {
  const baseURL = `/api/napcat`
  return axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    },
  })
}

export async function getGroupList(config: NapCatConfig): Promise<GroupInfo[]> {
  const client = createClient(config)
  const { data } = await client.post('/get_group_list')
  return data.data ?? []
}

export async function getFriendList(config: NapCatConfig): Promise<FriendInfo[]> {
  const client = createClient(config)
  const { data } = await client.post('/get_friend_list')
  return data.data ?? []
}

export async function getGroupMsgHistory(
  config: NapCatConfig,
  groupId: number,
  count: number,
  messageSeq?: number,
): Promise<NapCatMessageHistory> {
  const client = createClient(config)
  const body: Record<string, unknown> = { group_id: groupId, count }
  if (messageSeq !== undefined) {
    body.message_seq = messageSeq
  }
  const { data } = await client.post('/get_group_msg_history', body)
  return data.data ?? { messages: [] }
}

export async function getFriendMsgHistory(
  config: NapCatConfig,
  userId: number,
  count: number,
  messageSeq?: number,
): Promise<NapCatMessageHistory> {
  const client = createClient(config)
  const body: Record<string, unknown> = { user_id: userId, count }
  if (messageSeq !== undefined) {
    body.message_seq = messageSeq
  }
  const { data } = await client.post('/get_friend_msg_history', body)
  return data.data ?? { messages: [] }
}

export async function getGroupMemberList(
  config: NapCatConfig,
  groupId: number,
): Promise<GroupMemberInfo[]> {
  const client = createClient(config)
  const { data } = await client.post('/get_group_member_list', {
    group_id: groupId,
  })
  return data.data ?? []
}

export async function testConnection(config: NapCatConfig): Promise<boolean> {
  try {
    await getGroupList(config)
    return true
  } catch {
    return false
  }
}
