# Chatnip — QQ 群聊智能分析工具

Chatnip 是一款桌面 Web 应用，通过连接 [NapCat](https://github.com/NapNeko/NapCatQQ) QQ 机器人框架获取聊天记录，并借助大语言模型（LLM）对 QQ 群聊、私聊进行深度分析。

## ✨ 功能特性

- **连接 QQ** — 接入 NapCat 机器人，浏览群组和好友列表
- **智能分析** — 按日期范围拉取聊天记录，交由 AI 进行多维度分析
- **七大分析维度**：
  - 📋 基础总结 — 话题概览、时间分布、参与人数、氛围评价
  - 🏷️ 话题聚类 — 识别 3-8 个主要话题，描述演变过程
  - 😊 情感分析 — 发言者情绪倾向与整体情感走势
  - 🔥 活跃度排行 — TOP 10 活跃成员，按时间段分布
  - 🔑 关键词提取 — 10-20 个高频关键词/短语
  - ✅ 关键结论与待办 — 共识/决议、待办事项、遗留问题
  - 🔗 关系洞察 — 互动最频繁的成员对、意见领袖、社交结构
- **会话管理** — 保存、查看、删除历史分析记录
- **追问互动** — 分析结果支持继续追问，实现对话式探索
- **暗色模式** — 支持亮色/暗色主题切换

## 🏗️ 架构概览

```
用户浏览器 (React App)
    │
    ├── /api/napcat/* ──── Vite 代理 ──── NapCat Server (QQ 机器人)
    │   (获取群组列表、聊天记录等)
    │
    ├── /api/opencode/* ── Vite 代理 ──── Opencode Serve (端口 4096)
    │   (创建会话、发送提示词、管理模型)
    │
    ├── /__api/chat-history/write ── 写入聊天文本文件到本地磁盘
    └── /__api/app-state/save ─────── 持久化应用状态到本地 JSON
```

项目采用 **无独立后端** 架构：Vite 开发服务器同时承担静态文件服务和 API 网关的职责。

## 🛠️ 技术栈

| 类别     | 技术                                         |
| -------- | -------------------------------------------- |
| 框架     | React 19 + TypeScript                        |
| 构建     | Vite 6                                       |
| UI       | HeroUI v3 + Tailwind CSS v4                  |
| 状态管理 | Redux Toolkit                                |
| 路由     | React Router v7                              |
| HTTP     | Axios                                        |
| AI 平台  | [Opencode](https://opencode.ai) SDK           |
| QQ 接入  | [NapCat](https://github.com/NapNeko/NapCatQQ) |

## 📋 前置要求

- **Node.js** >= 22
- **NapCat** QQ 机器人已部署并运行（默认端口 3000）
- **Opencode** CLI 已安装（`npm i -g opencode`）或项目会自动启动

## 🚀 快速开始

### 1. 安装依赖

```bash
git clone https://github.com/not-exist/Chatnip
cd chatnip
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

Vite 将自动启动 Opencode 服务（端口 4096）并代理 NapCat API 请求。

应用将在 `http://localhost:5173` 运行。

### 3. 配置

打开应用后进入 **设置页面**，配置：
- **NapCat 地址** — 默认 `127.0.0.1:3000`
- **Opencode 地址** — 默认 `127.0.0.1:4096`
- **默认 AI 模型** — 选择一个可用的模型

## 📖 使用流程

1. **选择聊天** — 在首页浏览 QQ 群组或好友列表，点击进入
2. **配置分析** — 选择日期范围、分析维度、AI 模型
3. **执行分析** — 点击开始，等待 AI 生成多维度分析报告
4. **查看结果** — 浏览可折叠的维度卡片，支持追问深入探讨
5. **管理会话** — 在会话列表中查看、回顾或删除历史分析

## 📁 项目结构

```
src/
├── api/               # NapCat / Opencode API 客户端
├── components/        # 可复用组件
│   ├── AppNavbar.tsx
│   ├── ChatCard.tsx
│   ├── DimensionCard.tsx
│   ├── ConversationView.tsx
│   ├── DateRangePicker.tsx
│   └── ...
├── hooks/             # 自定义 React Hooks
├── pages/             # 页面组件
│   ├── ChatListPage.tsx         # 群组/好友列表
│   ├── NewAnalysisPage.tsx      # 新建分析
│   ├── SessionDetailPage.tsx    # 分析详情
│   ├── SessionsPage.tsx         # 会话列表
│   └── SettingsPage.tsx         # 设置
├── prompts/           # AI 提示词工程
├── store/             # Redux 状态管理
├── types/             # TypeScript 类型定义
├── App.tsx            # 根组件
├── main.tsx           # 入口
└── router.tsx         # 路由配置
```

## 🔧 可用命令

| 命令               | 说明                 |
| ------------------ | -------------------- |
| `npm run dev`        | 启动 Vite 开发服务器 |
| `npm start`          | 通过 start.js 启动   |
| `npm run build`      | 生产构建 → `dist/`     |
| `npm run preview`    | 预览生产构建         |
| `npm run lint`       | ESLint 代码检查      |
| `npm run typecheck`  | TypeScript 类型检查  |
| `npm test`           | 运行测试             |
| `npm run test:watch` | 测试监视模式         |

## 🧪 测试

```bash
npm test
```

测试使用 Vitest + React Testing Library + jsdom。

## 📄 许可证

本项目基于 [GNU General Public License v3.0](LICENSE) 开源。
