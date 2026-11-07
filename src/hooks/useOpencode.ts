import { useCallback } from 'react'
import * as opencodeApi from '@/api/opencode'
import type { FilePartInput } from '@/api/opencode'
import { registerSession, unregisterSession, getRegisteredSessions } from '@/store/sessionRegistry'
import type { ChatType, SessionInfo, ModelInfo } from '@/types'

interface CreateSessionParams {
  title: string
  chatType: ChatType
  chatId: number
  chatName: string
  features: string[]
}

export function useOpencode() {
  const createSession = useCallback(
    async (params: CreateSessionParams) => {
      const session = await opencodeApi.createSession(params.title)
      await opencodeApi.updateSessionTitle(session.id, params.title)
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
    [],
  )

  const deleteSession = useCallback(
    async (id: string) => {
      await opencodeApi.deleteSession(id)
      unregisterSession(id)
    },
    [],
  )

  const listSessions = useCallback(async (): Promise<SessionInfo[]> => {
    const remoteSessions = (await opencodeApi.listSessions()) ?? []
    const registry = getRegisteredSessions()
    return remoteSessions.map((remote) => {
      const registered = registry[remote.id]
      return {
        id: remote.id,
        title: remote.title || registered?.title || '未命名会话',
        createdAt: remote.time?.created || registered?.createdAt || Date.now(),
        chatType: registered?.chatType ?? 'group',
        chatId: registered?.chatId ?? 0,
        chatName: registered?.chatName ?? '',
        features: registered?.features ?? [],
      }
    })
  }, [])

  const getMessages = useCallback(
    (id: string) => opencodeApi.getSessionMessages(id),
    [],
  )

  const sendPrompt = useCallback(
    (sessionId: string, text: string, model?: ModelInfo) =>
      opencodeApi.sendPrompt(sessionId, text, model),
    [],
  )

  const sendPromptWithFiles = useCallback(
    (sessionId: string, text: string, system: string, files: FilePartInput[], model?: ModelInfo) =>
      opencodeApi.sendPromptWithFiles(sessionId, text, system, files, model),
    [],
  )

  const listProviders = useCallback(
    () => opencodeApi.listProviders(),
    [],
  )

  const testConnection = useCallback(
    () => opencodeApi.testOpencodeConnection(),
    [],
  )

  return { createSession, deleteSession, listSessions, getMessages, sendPrompt, sendPromptWithFiles, listProviders, testConnection }
}
