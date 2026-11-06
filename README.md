# Chatnip — QQ 群聊智能分析桌面应用

Chatnip 通过连接 QQ 机器人框架获取聊天记录，并借助大语言模型（LLM）对 QQ 群聊、私聊进行深度分析。

> 桌面版基于 Electron：双击启动，应用自行管理 Opencode，并引导安装/连接 NapCat。
>
> 也保留原有的 Web 开发模式（Vite dev server）。

## ✨ 功能

- **连接 QQ** — 接入 NapCat 机器人，浏览群组和好友列表
- **智能分析** — 按日期范围拉取聊天记录，交由 AI 进行多维度分析
- **七大分析维度**：基础总结、话题聚类、情感分析、活跃度排行、关键词提取、关键结论与待办、关系洞察
- **会话管理** — 保存、查看、删除历史分析记录
- **追问互动** — 分析结果支持继续追问
- **暗色模式** — 亮色/暗色主题切换

## 🏗️ 桌面版架构

```
Electron 主进程
├─ app://chatnip           静态 renderer（稳定 origin，SPA fallback，CSP）
├─ Hono local server       127.0.0.1 随机端口 + X-Chatnip-Token
│  ├─ /api/napcat/*        → NapCat OneBot HTTP
│  ├─ /api/opencode/*      → opencode serve（含 SSE 流式）
│  ├─ /__api/chat-history/* 每次分析独立目录
│  └─ /__api/app-state/*   原子读写 app-state.json
├─ ServiceManager
│  ├─ OpencodeService      固定 V1.19.5，下载/校验/启动/健康检查/重启
│  └─ QqService            NapCat 检测/配置/健康检查/WebUI
└─ userData                app-state、聊天记录、日志、二进制、配置
```

技术栈：Electron 45、electron-vite 6、electron-builder 26、React 19、Vite 6、TypeScript、HeroUI v3、Tailwind v4、Redux Toolkit、Hono。

## 📋 前置要求

- Windows 10+ / macOS 13+ / Linux x64
- 一个可登录的 QQ 账号（存在账号风控风险，请自行评估）
- NapCat：应用会引导安装；Windows/Linux/macOS 12+ 均有官方安装方式
- Opencode：应用自动下载固定版本 `1.19.5`（首次启动需要网络）

## 🚀 开发

```bash
npm ci

# 桌面开发（Vite 热更新 + Electron 窗口）
npm run dev:electron

# 纯 Web 开发（原有模式，API 由 Vite 中间件提供）
npm run dev

# 检查
npm run typecheck          # renderer
npm run typecheck:node     # Electron main/preload
npm run lint
npm test

# 构建
npm run build:electron     # out/main + out/preload + out/renderer
npm run build              # 原有 Web 构建 → dist/

# 打包（当前平台）
npx electron-builder --dir
```

## 🖥️ 首次启动

1. 应用打开“首次启动”向导。
2. **Opencode**：点击“安装 / 修复”，应用下载 `1.19.5` 并启动；状态变为“运行中”。
3. **NapCat**：点击“安装 NapCat”打开官方 Release；按平台安装：
   - Windows：`NapCat.Shell.Windows.OneKey.zip`
   - Linux：官方 `napcat.sh`（Docker 或本机 QQ + Xvfb）
   - macOS：先安装 `/Applications/QQ.app`，再运行 `NapCat-Mac-Installer`
4. 打开 NapCat WebUI，扫码登录 QQ，开启 OneBot HTTP（默认 `127.0.0.1:3000`）并设置 access token。
5. 在 Chatnip 设置页填入 NapCat 地址与 token；两个服务都“运行中”后进入 Chatnip。

## 📁 数据目录

| 平台 | userData |
|---|---|
| Windows | `%LOCALAPPDATA%\chatnip`（兼容旧 Web 版数据） |
| macOS | `~/Library/Application Support/Chatnip` |
| Linux | `~/.config/Chatnip` |

子目录：`app-state.json`、`chat-history/<analysisId>/`、`logs/`、`bin/opencode/`、`config/qq.json`、`workspace/`。

可用 `CHATNIP_USER_DATA=/path` 覆盖（测试/便携模式）。

## 📦 发布

- 三平台安装包：Windows NSIS、macOS DMG/zip、Linux AppImage/deb。
- 打 tag `v*` 触发 `.github/workflows/release.yml`，产出 draft GitHub Release。
- 代码签名/公证为可选项：配置 `CSC_LINK`/`CSC_KEY_PASSWORD`、Apple 公证凭据后启用。
- 自动更新由 `electron-updater` 接入 GitHub Releases；未签名时用户需手动放行。

## ⚠️ 重要说明

- **QQ 账号风险**：使用第三方 QQ 机器人框架可能导致账号受限；应用不会自动登录、不存储 QQ 密码，请自行评估。
- **NapCat 许可证**：NapCat 使用非商业 Limited Redistribution License。Chatnip **不内置打包 NapCat**，只引导用户从官方渠道安装；商业分发前需取得 NapCat 作者授权。
- **GitHub 网络**：Opencode 首次下载来自 GitHub Releases；网络受限时可手动安装并在设置中指定本地二进制（后续版本支持）。

## 🧪 测试

```bash
npm test
```

Vitest + React Testing Library + jsdom；另有 `tsc`、ESLint、Electron 构建作为 CI 门禁。

## 📄 许可证

本项目基于 [GNU General Public License v3.0](LICENSE) 开源。
