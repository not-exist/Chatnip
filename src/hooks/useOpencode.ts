import { useCallback } from 'react'
import { useAppSelector } from '@/store'
import * as opencodeApi from '@/api/opencode'

export function useOpencode() {
  const config = useAppSelector((s) => s.settings.opencode)

  const createSession = useCallback(
    (title: string) => opencodeApi.createSession(config, title),
    [config],
  )
  const deleteSession = useCallback(
    (id: string) => opencodeApi.deleteSession(config, id),
    [config],
  )
  const listSessions = useCallback(() => opencodeApi.listSessions(config), [config])
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
