import { useCallback } from 'react'
import { useAppSelector } from '@/store'
import * as napcatApi from '@/api/napcat'

export function useNapcatApi() {
  const config = useAppSelector((s) => s.settings.napcat)

  const getGroupList = useCallback(() => napcatApi.getGroupList(config), [config])
  const getFriendList = useCallback(() => napcatApi.getFriendList(config), [config])
  const getGroupMsgHistory = useCallback(
    (groupId: number, count: number) => napcatApi.getGroupMsgHistory(config, groupId, count),
    [config],
  )
  const getFriendMsgHistory = useCallback(
    (userId: number, count: number) => napcatApi.getFriendMsgHistory(config, userId, count),
    [config],
  )
  const testConnection = useCallback(() => napcatApi.testConnection(config), [config])

  return { getGroupList, getFriendList, getGroupMsgHistory, getFriendMsgHistory, testConnection }
}
