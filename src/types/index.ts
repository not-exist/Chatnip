export interface NapCatConfig {
  host: string
  port: number
  token: string
}

export interface OpencodeConfig {
  host: string
  port: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

export interface ModelInfo {
  providerID: string
  modelID: string
  name: string
}

export interface ProviderInfo {
  id: string
  name: string
  models: Record<string, { id: string; name: string }>
}

export interface SettingsState {
  napcat: NapCatConfig
  opencode: OpencodeConfig
  defaultMessageCount: number
  defaultFeatures: string[]
  defaultModel?: ModelInfo
}

export interface GroupInfo {
  group_id: number
  group_name: string
  member_count: number
  max_member_count: number
}

export interface FriendInfo {
  user_id: number
  nickname: string
  remark: string
}

export interface GroupMemberInfo {
  user_id: number
  nickname: string
  card: string
}

export interface NapCatMessage {
  message_id: number
  user_id: number
  nickname?: string
  time: number
  message: string | Array<{ type: string; data: Record<string, unknown> }>
}

export interface NapCatMessageHistory {
  messages: NapCatMessage[]
}

export type ChatType = 'group' | 'friend'

export interface SessionInfo {
  id: string
  title: string
  createdAt: number
  chatType: ChatType
  chatId: number
  chatName: string
  features: string[]
}

export interface FeatureOption {
  key: string
  label: string
  description: string
}

export interface AnalysisResult {
  sessionId: string
  text: string
}
