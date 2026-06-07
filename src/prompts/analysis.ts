import type { ChatType, FeatureOption } from '@/types'

export const FEATURE_OPTIONS: FeatureOption[] = [
  {
    key: 'summary',
    label: '基础总结',
    description: '话题概述、时间分布、参与人数、交流氛围',
  },
  {
    key: 'topics',
    label: '话题聚类',
    description: '识别 3-8 个主要话题，描述演变关系',
  },
  {
    key: 'sentiment',
    label: '情感分析',
    description: '发言人情绪倾向、整体情绪趋势',
  },
  {
    key: 'activity',
    label: '活跃度排行',
    description: 'TOP 10 发言人、发言时段分布',
  },
  {
    key: 'keywords',
    label: '关键词提取',
    description: '10-20 个高频关键词/短语',
  },
  {
    key: 'conclusions',
    label: '关键结论与待办',
    description: '共识/决议、待办事项、悬而未决的问题',
  },
  {
    key: 'relations',
    label: '关系洞察',
    description: '互动最频繁的成员对、意见领袖、社交结构',
  },
]

const FEATURE_PROMPTS: Record<string, string> = {
  summary: `## 基础总结
- 用 2-3 句话概括讨论主题
- 列出讨论的时间分布（什么时间段最活跃）
- 统计参与人数
- 描述整体交流氛围（友好/争论/工作/闲聊）`,

  topics: `## 话题聚类
- 识别 3-8 个主要话题，按讨论深度排序
- 对每个话题：一句话概括 + 涉及的消息数量 + 起止时间
- 描述话题之间的演变关系`,

  sentiment: `## 情感分析
- 以表格列出主要发言人及其情绪倾向（正面/负面/中性比例）
- 描述整体情绪趋势（逐渐升温/逐渐平缓/多次转折）
- 标记情绪转折点和可能的原因`,

  activity: `## 活跃度排行
- 以表格列出 TOP 10 发言人，含发言次数和占比
- 分析发言时段分布（上午/下午/晚上/深夜）
- 标记发言最密集的时间窗口`,

  keywords: `## 关键词提取
- 提取 10-20 个高频关键词/短语
- 按出现频次降序排列
- 标注每个关键词首次出现的时间和发言人`,

  conclusions: `## 关键结论
- 列出讨论中达成的共识或决议
- 提取明确提到的待办事项及其负责人
- 标注悬而未决的问题`,

  relations: `## 关系洞察
- 标记互动最频繁的成员对（谁回复谁最多）
- 分析是否存在明显的"意见领袖"
- 描述群内社交结构（紧密/松散/两级分化）`,
}

export function getSystemPrompt(): string {
  return `你是一个专业的 QQ 聊天记录分析师。用户会提供一段 QQ 聊天记录，请严格按照用户指定的分析维度进行深度分析。

要求：
1. 严格基于提供的聊天记录，不编造、不臆测任何信息
2. 每个分析维度作为独立的二级标题章节输出（## 维度名）
3. 统计数据使用表格呈现
4. 具体结论引用原文消息作为证据（格式：> [时间] 昵称: "原文"）
5. 使用中文输出，表达简洁专业
6. 如果某个维度信息不足（如消息太少无法做情感分析），诚实说明而非强行凑数`
}

export function getFeaturePrompts(features: string[]): string {
  return features
    .map((key) => FEATURE_PROMPTS[key])
    .filter(Boolean)
    .join('\n\n')
}

export function getFeatureLabels(features: string[]): string {
  return features
    .map((key) => {
      const opt = FEATURE_OPTIONS.find((f) => f.key === key)
      return opt ? `- ${opt.label}：${opt.description}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function extractNickname(msg: { sender?: { nickname?: string; card?: string } }) {
  return msg.sender?.card || msg.sender?.nickname || '未知'
}

function extractTextContent(message: unknown): string {
  if (typeof message === 'string') {
    return message
  }
  if (Array.isArray(message)) {
    return (message as Array<{ type: string; data?: { text?: string } }>)
      .map((seg) => {
        if (seg.type === 'text' && seg.data?.text) return seg.data.text
        if (seg.type === 'image') return '[图片]'
        if (seg.type === 'face') return '[表情]'
        if (seg.type === 'record') return '[语音]'
        if (seg.type === 'at') return `@${(seg.data as { qq?: string } | undefined)?.qq || '某人'}`
        if (seg.type === 'reply') return '[回复]'
        return `[${seg.type}]`
      })
      .join('')
  }
  return String(message)
}

export function formatMessages(
  messages: Array<{ time: number; user_id: number; message: unknown; nickname?: string }>,
): string {
  return messages
    .slice()
    .reverse()
    .map((msg) => {
      const time = new Date(msg.time * 1000).toLocaleString('zh-CN')
      const name = extractNickname(msg as never) || msg.nickname || msg.user_id.toString()
      const text = extractTextContent(msg.message)
      return `[${time}] ${name}: ${text}`
    })
    .join('\n')
}

export function buildUserPrompt(params: {
  chatType: ChatType
  chatName: string
  messageCount: number
  features: string[]
  earliestTime: string
  latestTime: string
  formattedMessages: string
}): string {
  const { chatType, chatName, messageCount, features, earliestTime, latestTime, formattedMessages } = params
  const typeLabel = chatType === 'group' ? '群聊' : '私聊'
  const featureList = getFeatureLabels(features)

  return `## 会话信息
- 类型：${typeLabel}
- 名称：${chatName}
- 消息条数：${messageCount} 条
- 时间范围：${earliestTime} ~ ${latestTime}

## 需要分析的维度
${featureList}

## 聊天记录
---
${formattedMessages}
---`
}
