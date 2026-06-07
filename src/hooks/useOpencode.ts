import { useCallback } from 'react'
import { useAppSelector } from '@/store'
import * as opencodeApi from '@/api/opencode'
import { registerSession, unregisterSession, getRegisteredSessions, updateSessionTitle } from '@/store/sessionRegistry'
import type { ChatType, SessionInfo } from '@/types'

interface CreateSessionParams {
  title: string
  chatType: ChatType
  chatId: number
  chatName: string
  features: string[]
}

export function useOpencode() {
  const config = useAppSelector((s) => s.settings.opencode)

  const createSession = useCallback(
    async (params: CreateSessionParams) => {
      const session = await opencodeApi.createSession(config, params.title)
      await opencodeApi.updateSessionTitle(config, session.id, params.title)
      registerSession({
        id: session.id,
        title: params.title,
        chatType: params.chatType,
        chatId: params.chatId,
        chatName: params.chatName,
        features: params.features,
        createdAt: Date.now(),
      })
      return session
    },
    [config],
  )

  const deleteSession = useCallback(
    async (id: string) => {
      await opencodeApi.deleteSession(config, id)
      unregisterSession(id)
    },
    [config],
  )

  const listSessions = useCallback(async (): Promise<SessionInfo[]> => {
    const remoteSessions = (await opencodeApi.listSessions(config)) ?? []
    const registry = getRegisteredSessions()
    const remoteMap = new Map(remoteSessions.map((s) => [s.id, s]))
    return Object.values(registry)
      .filter((r) => remoteMap.has(r.id))
      .map((r) => {
        const remote = remoteMap.get(r.id)!
        return {
          id: r.id,
          title: remote.title || r.title,
          createdAt: remote.time?.created || r.createdAt,
          chatType: r.chatType,
          chatId: r.chatId,
          chatName: r.chatName,
          features: r.features,
        }
      })
  }, [config])

  const getMessages = useCallback(
    (id: string) => opencodeApi.getSessionMessages(config, id),
    [config],
  )

  const sendPrompt = useCallback(
    (sessionId: string, text: string) => opencodeApi.sendPrompt(config, sessionId, text),
    [config],
  )

  const testConnection = useCallback(
    () => opencodeApi.testOpencodeConnection(config),
    [config],
  )

  return { createSession, deleteSession, listSessions, getMessages, sendPrompt, testConnection }
}
