# QQ AI Chat Analyzer - Requirements

## 目标

构建一个与 NapCat WebUI 风格一致的 Web 应用，通过 NapCat OneBot API 拉取 QQ 聊天记录，利用 opencode Session API 进行 AI 分析，支持多轮追问。

## 功能需求

| 编号 | 需求 | 优先级 |
|---|---|---|
| R1 | 配置 NapCat OneBot HTTP API 连接（host/port/token） | P0 |
| R2 | 配置 opencode Server 连接（host/port） | P0 |
| R3 | 查看群聊列表、好友列表，支持搜索过滤 | P0 |
| R4 | 选择目标会话，配置消息拉取条数（10-500）和分析维度 | P0 |
| R5 | 拉取聊天记录并格式化，发送给 AI 分析 | P0 |
| R6 | AI 分析完成后自动创建 opencode session，结果 Markdown 渲染 | P0 |
| R7 | 在分析结果页面追问（同 session 多轮对话） | P0 |
| R8 | 历史分析会话列表、搜索、删除 | P0 |
| R9 | 暗色/亮色主题切换（对齐 NapCat 设计 tokens） | P1 |
| R10 | NapCat 连接状态检测 | P1 |

## 分析维度

| 维度 | key | 默认开启 |
|---|---|---|
| 基础总结（话题、时间、人数、氛围） | `summary` | 必含 |
| 话题聚类与演变 | `topics` | ✓ |
| 情感分析 | `sentiment` | ✓ |
| 活跃度排行 | `activity` | |
| 关键词提取 | `keywords` | |
| 关键结论与待办 | `conclusions` | |
| 关系洞察 | `relations` | |

## 技术约束

- 前端：React 19 + Vite 6 + TypeScript + HeroUI + Tailwind CSS 3
- 状态：Redux Toolkit
- AI 后端：opencode Server（`opencode serve`）
- QQ 后端：NapCat OneBot HTTP API
- NapCat API 调用通过 Vite proxy 转发解决 CORS
- 设计 tokens 对齐 NapCat WebUI（樱花粉主色、冰霜蓝次色）

## 非功能需求

- 会话无持久化代码——全部由 opencode Server 内置 SQLite 管理
- 页面加载 < 2s
- 支持主流现代浏览器
