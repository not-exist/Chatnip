# QQ AI Chat Analyzer - Tasks

| # | 任务 | 文件 | 验证方式 | AFK/HITL |
|---|---|---|---|---|
| 1 | 项目初始化：Vite + React + TypeScript + Tailwind + HeroUI + Redux + Router | package.json, vite.config.ts, tailwind.config.js, main.tsx, router.tsx | npm run dev 启动成功 | AFK |
| 2 | 设计系统：Tailwind/HeroUI theme 对齐 NapCat tokens，Layout 组件含 Navbar + 主题切换 | tailwind.config.js, index.css, Layout.tsx, App.tsx | 页面渲染 NapCat 风格、主题可切换 | AFK |
| 3 | SettingsPage：NapCat 连接配置 + opencode 连接配置 + 默认分析维度、消息条数 | SettingsPage.tsx, settingsSlice.ts, store/index.ts | 表单可填写、本地持久化 | AFK |
| 4 | NapCat API 层：axios 封装，含 get_group_list / get_friend_list / get_group_msg_history / get_friend_msg_history / get_group_member_list | api/napcat.ts, types/index.ts | 能调用 NapCat API 获取群列表 | AFK |
| 5 | ChatListPage：Tab 切换群聊/好友列表、搜索过滤、点击跳转 | ChatListPage.tsx, ChatCard.tsx | 列表渲染、搜索过滤、点击跳转 | AFK |
| 6 | Opencode SDK 封装 + AI Prompt 模板 | api/opencode.ts, hooks/useOpencode.ts, prompts/analysis.ts | 能创建 session、发送 prompt、获取消息 | AFK |
| 7 | NewAnalysisPage：会话信息展示 + 消息条数 slider + 分析维度勾选 + 消息拉取 + 格式化 + 分析执行 + 流转 | NewAnalysisPage.tsx, AnalysisFeatureSelector.tsx, AnalysisResultView.tsx | 选择会话 → 配置参数 → 拉取消息 → AI 分析 → 跳转 | AFK |
| 8 | SessionDetailPage：加载历史消息、Markdown 渲染、追问输入、发送追问 | SessionDetailPage.tsx, ConversationView.tsx, ChatInput.tsx | 查看分析结果、追问、对话更新 | AFK |
| 9 | SessionsPage：会话列表、搜索、标题、删除确认 | SessionsPage.tsx, SessionCard.tsx | 列表渲染、搜索、删除 | AFK |
| 10 | Vite proxy 配置：/api/napcat 代理到 NapCat | vite.config.ts | NapCat API 无 CORS 错误 | AFK |
| 11 | 最终验证：全流程端到端测试 + lint + typecheck | — | 全流程通过 | AFK |
