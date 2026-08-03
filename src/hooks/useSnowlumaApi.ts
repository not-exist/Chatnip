import { useCallback } from 'react'
import * as snowlumaApi from '@/api/snowluma'

export function useSnowlumaApi() {
  const getGroupList = useCallback(() => snowlumaApi.getGroupList(), [])
  const getFriendList = useCallback(() => snowlumaApi.getFriendList(), [])
  const getGroupMsgHistory = useCallback(
    (groupId: number, count: number, messageSeq?: number) =>
      snowlumaApi.getGroupMsgHistory(groupId, count, messageSeq),
    [],
  )
  const getFriendMsgHistory = useCallback(
    (userId: number, count: number, messageSeq?: number) =>
      snowlumaApi.getFriendMsgHistory(userId, count, messageSeq),
    [],
  )
  const testConnection = useCallback(() => snowlumaApi.testConnection(), [])

  return { getGroupList, getFriendList, getGroupMsgHistory, getFriendMsgHistory, testConnection }
}
