import axios, { type AxiosInstance } from 'axios'
import { apiUrl, getApiToken } from '@/api/runtime'
import type {
  NapCatConfig,
  GroupInfo,
  FriendInfo,
  GroupMemberInfo,
  NapCatMessageHistory,
} from '@/types'

function createClient(config: NapCatConfig): AxiosInstance {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.token) headers.Authorization = `Bearer ${config.token}`
  const bridgeToken = getApiToken()
  if (bridgeToken) headers['x-chatnip-token'] = bridgeToken

  return axios.create({
    baseURL: apiUrl('/api/napcat'),
    timeout: 30000,
    headers,
  })
}

function assertNapcatOk(data: unknown): void {
  if (typeof data !== 'object' || data === null) return
  const record = data as { status?: unknown; retcode?: unknown; message?: unknown }
  if (record.status === 'failed' || (typeof record.retcode === 'number' && record.retcode !== 0)) {
    const detail = typeof record.message === 'string' ? record.message : `retcode ${String(record.retcode)}`
    throw new Error(`NapCat 返回错误: ${detail}`)
  }
}

export async function getGroupList(config: NapCatConfig): Promise<GroupInfo[]> {
  const client = createClient(config)
  const { data } = await client.post('/get_group_list')
  assertNapcatOk(data)
  return data.data ?? []
}

export async function getFriendList(config: NapCatConfig): Promise<FriendInfo[]> {
  const client = createClient(config)
  const { data } = await client.post('/get_friend_list')
  assertNapcatOk(data)
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
  if (messageSeq !== undefined) body.message_seq = String(messageSeq)
  const { data } = await client.post('/get_group_msg_history', body)
  assertNapcatOk(data)
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
  if (messageSeq !== undefined) body.message_seq = String(messageSeq)
  const { data } = await client.post('/get_friend_msg_history', body)
  assertNapcatOk(data)
  return data.data ?? { messages: [] }
}

export async function getGroupMemberList(
  config: NapCatConfig,
  groupId: number,
): Promise<GroupMemberInfo[]> {
  const client = createClient(config)
  const { data } = await client.post('/get_group_member_list', { group_id: groupId })
  assertNapcatOk(data)
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
