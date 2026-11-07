# Chatnip 桌面分发改造 — 设计文档

- 日期：2026-11-05
- 状态：已批准并进入实现；M1–M6 核心已落地（2026-11-06），详见 `docs/superpowers/notes/2026-11-06-m1-results.md`
- 目标读者：实现者（本会话或 fork `master-feat`）

## 1. 意图与背景

Chatnip 目前是“Vite dev server 即后端”的本地 Web 应用：`vite.config.ts` 的 `configureServer` 承担 NapCat/Opencode 代理、聊天文件写入、app-state 持久化与进程管理。master 分支开发链路全绿，但存在明确局限：

- 生产构建无法独立运行（API 只存在于 dev server）；
- Windows 路径假设在 Linux/macOS 失效；
- 历史消息分页、时区分组、并发清理、状态持久化等正确性问题；
- 本地 API 无鉴权、token 明文、进程管理按端口杀等安全/稳定性问题。

目标是把 Chatnip 变成**可分发给其他用户的跨平台桌面应用**（Windows / Linux / macOS），双击即用，由 App 自己管理 Opencode 与 QQ 接入服务。

## 2. 目标 / 非目标 / 反目标

### Goals
1. Electron 桌面应用：Windows NSIS、macOS DMG、Linux AppImage/deb；双击启动。
2. 生产形态完整可用：不依赖 Vite dev server；renderer 与本地 API 由主进程提供。
3. App 管理 Opencode：固定 V1 版本、自动下载/校验/启动/健康检查/重启/日志；离线兜底。
4. App 管理 QQ 接入：优先自动下载/安装；平台不支持时引导安装并检测；首次启动向导与 QQ 登录引导。
5. 修复 master 已识别的正确性/安全/跨平台问题。
6. 可维护：dev 模式热更新保留；CI 三平台构建；自动更新。

### Non-goals
- 不改写 UI/交互与分析功能本身。
- 不做多用户托管服务（仍为单机本地应用）。
- 不实现 QQ 协议绕过/反检测；只集成官方/开源 QQ 接入框架。
- 不承诺在 NapCat/SnowLuma 不支持的平台上提供 QQ 功能。

### Anti-goals
- 要求用户手动安装 Node/npm 才能使用。
- 明文存储 QQ/Opencode 凭据。
- 按端口杀进程、杀无关进程。
- 静默失败或把服务错误统一成“连接失败”。

## 3. 约束

- 现有技术栈：React 19 + Vite 6.4.5 + TS + HeroUI v3 + Tailwind v4 + Redux Toolkit。
- 许可证：GPLv3（分发需提供对应源码；第三方组件许可需逐项核对）。
- Electron 45（Chromium 156 / Node 24.22）要求 macOS 13+。
- CI 现用 Node 24；无原生 Node 模块，暂不需要 electron-rebuild。
- 网络：中国大陆用户可能无法直连 GitHub；下载需镜像/回退/离线包策略。

## 4. 目标架构

```
┌──────────────────────────── Electron 主进程 ────────────────────────────┐
│ app 生命周期 / 单实例锁 / 窗口 / 自动更新                                │
│                                                                          │
│  app://chatnip  (自定义协议，稳定 origin，SPA fallback，CSP)             │
│         │                                                                │
│         ├── renderer（现有 React 构建产物，loadURL('app://chatnip/')）   │
│         │        └── 通过 preload 拿到 apiBase + token                   │
│         │                                                                │
│  Hono HTTP server @ 127.0.0.1:<random>                                   │
│    ├─ /api/napcat/*            → QQ 接入服务代理（NapCat/SnowLuma）      │
│    ├─ /api/opencode/*          → opencode serve 代理（含 SSE 流式）      │
│    ├─ /__api/opencode/restart  → 受控重启                                │
│    ├─ /__api/chat-history/*    → 按分析任务分目录写入/清理               │
│    ├─ /__api/app-state/*       → 原子读写 app-state.json                 │
│    └─ /__api/qq-config         → QQ 服务配置                             │
│                                                                          │
│  ServiceManager                                                          │
│    ├─ OpencodeService: 下载/校验/解压/spawn/健康检查/退避重启/日志        │
│    └─ QqService: 安装策略 / 启动 / 健康检查 / WebUI 登录引导              │
│                                                                          │
│  Storage: app.getPath('userData')                                        │
└──────────────────────────────────────────────────────────────────────────┘
        ▲
        │ contextBridge 只暴露 apiBase/token/版本/服务状态订阅
   preload (sandbox + contextIsolation)
```

### 4.1 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 桌面壳 | Electron 45 + electron-vite 6 + electron-builder 26.18 + electron-updater 6.8 | 现有后端是 Node 代码，迁移成本最低；三平台安装器/更新成熟 |
| renderer 生产加载 | 自定义 `app://chatnip` 协议 + SPA fallback | 稳定 origin，localStorage 不因随机端口丢失；BrowserRouter 可用 |
| 后端承载 | 主进程内嵌 Hono HTTP server，绑定 `127.0.0.1:0` | 保留现有相对路径与约 400 行中间件逻辑；改动远小于 IPC 化 |
| API 鉴权 | 每次启动随机 32B token；`X-Chatnip-Token`；Host/Origin 校验 | 防本机其他进程/网页调用 |
| Opencode | 锁 V1.19.5（与 SDK 对齐），运行期下载到 userData，SHA-256 校验 | V1/V2 命令互相覆盖；避免自动跨主版本 |
| QQ 接入 | **NapCat**；引导安装为主、自动下载为辅；统一 `QqService` 接口；不内置打包 | 官方支持 Win/Linux/macOS 12+，但安装器依赖 QQ/GUI；许可证为非商业 Limited Redistribution |
| 数据目录 | `app.setPath('userData', ...)`；Windows 沿用 `%LOCALAPPDATA%\chatnip` | 保留旧数据；macOS/Linux 用系统标准目录 |

### 4.2 数据布局

```
<userData>/
├─ app-state.json                 # settings + sessions（原子写）
├─ chat-history/<analysisId>/     # 每次分析独立临时目录
├─ logs/{main,opencode,qq}.log
├─ bin/opencode/<version>-<arch>/opencode[.exe]
├─ services/qq/                   # 安装目录/配置/日志（视方案）
└─ config/qq.json                 # 非敏感配置；token 用 safeStorage 加密
```

## 5. master 局限 → 修复映射

| # | master 局限 | 修复方案 | 验收 |
|---|---|---|---|
| 1 | API 仅在 Vite `configureServer`，生产不可用 | 抽出 `server/` 模块；Vite 插件与 Electron 主进程共用；Hono 承载 | `electron-builder` 产物双击后全流程可用；`npm run preview` 不再作为交付形态 |
| 2 | Windows 路径假设 | `app.getPath('userData')`；`pathToFileURL()`；旧 `%LOCALAPPDATA%\chatnip` 迁移 | Linux/macOS 写文件、opencode 读取文件均成功 |
| 3 | 分页把 `message_id` 当 `message_seq`，无去重 | 按 NapCat 实际契约使用锚点；跨批按 `message_id` 去重；停止条件改为空/不足/越过起始时间 | 固定群/好友 + 日期范围拉取完整，单测 + 真实 NapCat 联调 |
| 4 | 按 UTC 日期分组与本地过滤不一致 | 用本地 `YYYY-MM-DD` 生成文件 key | 东八区凌晨消息归入正确日期 |
| 5 | 清理接口删除共享聊天目录，并发互删 | 每次分析独立子目录；只清自己的；退出时清理残留 | 两个分析并发互不影响 |
| 6 | app-state 只写不读；localStorage 无保护 | 启动加载 + 合并；原子写；localStorage try/catch + 迁移 | 清缓存/换 origin 后可恢复；损坏 JSON 不崩溃 |
| 7 | 会话注册表与远端求交集，丢注册表即全丢 | 启动时用远端会话补全/重建；注册表缺失时降级显示 | 删除 localStorage 后会话仍可见可打开 |
| 8 | opencode host/port 设置无效 | 服务由 App 管理，设置页改为状态/日志/重启/自定义路径 | 设置项与实际行为一致 |
| 9 | 错误处理吞错、无超时/取消 | NapCat retcode 校验；统一错误映射；AbortController；Error Boundary | 断网/服务未启动/超时均有可行动提示 |
| 10 | 本地 API 无鉴权、token 明文、按端口杀进程 | token + Origin/Host 校验；safeStorage；只杀自有 PID | 安全清单逐项通过；不误杀 |
| 11 | 主包 861 kB、无 Error Boundary | 路由懒加载/manualChunks；Error Boundary | 首屏 chunk 明显下降；异常有兜底页 |
| 12 | 测试/CI 覆盖不足、分支保护未启用 | 单测 + Playwright Electron E2E；三平台 CI；分支保护 | CI 矩阵绿；E2E 覆盖首启/分析/追问 |
| 13 | README 仍按 Web/NapCat 部署 | 重写为桌面安装/首次启动/故障排查 | 新用户按文档可完成首次使用 |

## 6. 服务管理设计

### 6.1 OpencodeService（已确认）

- 版本：锁 **1.19.5**；SDK 从 `^1.16.2` 收紧到 `1.19.5`。
- 来源优先级：内置 manifest（GitHub Releases 固定 URL + SHA-256）→ npm 平台包（sha512 integrity）→ 用户手动选择二进制 → 离线安装包。
- 安装：下载 `.part` + Range 续传 → 校验 size/SHA-256 → 解压到临时目录 → chmod 0755 → 原子 rename → 写 version 文件。
- 启动：随机空闲端口 + `OPENCODE_SERVER_PASSWORD`（Basic auth）；`serve --hostname 127.0.0.1 --port <port>`；cwd = `userData/workspace`。
- 健康：`/global/health` 每 500ms，最长 60s；版本不匹配给出重装提示。
- 生命周期：单实例；崩溃指数退避重启（最多 3 次）；退出时 SIGTERM→SIGKILL（Windows taskkill /PID /T /F）；只管理自己的子进程。
- 日志：`userData/logs/opencode.log`，轮转，脱敏 Authorization/password。
- macOS：补 PATH（`/opt/homebrew/bin`、`/usr/local/bin`、`~/.local/bin`）；优先考虑随包签名 CLI，运行期下载仅作回退。

### 6.2 QqService（NapCat）

决策记录见 `docs/superpowers/notes/2026-11-05-qq-decision.md`。统一接口：`detect() / install() / start() / stop() / health() / loginUrl() / logs()`。

平台与安装策略：

| 平台 | 官方安装方式 | App 策略 |
|---|---|---|
| Windows 10/11 x64 | `NapCat.Shell.Windows.OneKey.zip`（自动部署 QQ，GUI/管理员）或 `NapCat.Shell.zip`（需已装 QQ） | 引导下载 OneKey；可选自动下载 zip 后由用户确认运行安装器；检测已有安装 |
| Linux x64 | 官方 `napcat.sh`（Docker 或本机 QQ + Xvfb）、手动安装、Docker Compose | 引导执行官方脚本；检测 Docker/QQ/NapCat；提供端口与 token 配置 |
| macOS 12+ Intel/Apple Silicon | 安装 `/Applications/QQ.app` → 运行 `NapCat-Mac-Installer`（需授权修改 QQ 入口） | 引导安装；不代改 QQ；检测安装结果 |

许可证约束（Limited Redistribution License，非商业）：

- **不把 NapCat 打入 Chatnip 安装包**；只从官方 Release/安装器地址下载，且不修改其代码。
- About/README/首次启动向导附许可证全文、来源链接与非商业声明；商业分发前需取得作者授权。
- 健康检查：OneBot `get_login_info`/`get_status`；登录通过 NapCat WebUI 扫码。
- 配置：`baseUrl` 默认 `http://127.0.0.1:3000`，access token 由用户在 WebUI 设置；token 用 `safeStorage` 加密存 `userData/config/qq.json`。
- 历史分页：`message_seq` 传上一批最旧消息的 `message_id` 是 NapCat 的兼容用法；深翻页（>5000 条）需实测短 ID 缓存淘汰行为。

## 7. 阶段与验收

### M0 决策与验证（1–2 天）
- NapCat/SnowLuma 平台支持矩阵定稿；确定 QQ 接入方案与是否支持 macOS。
- Opencode V1.19.5 下载/健康检查/SSE 代理冒烟。
- Electron 45 + electron-vite 6 + Vite 6.4.5 最小壳冒烟。
- **Exit**：所有高风险未知项有结论或明确的降级方案。

### M1 Electron 基础与后端抽取（3–5 天）
- 新建 `src/main` / `src/preload`；electron-vite 配置；`app://` 协议 + SPA fallback。
- 抽取中间件到 `src/main/server`（Hono）；dev 模式保留 Vite 插件。
- 6 处 API 调用改为 `apiBase + token`。
- **Exit**：`npm run dev` 与打包产物都能完整走通“连接服务 → 拉列表 → 分析 → 追问”。

### M2 数据目录与迁移（1–2 天）
- `userData` 布局；Windows 旧目录迁移；`pathToFileURL`；日志。
- app-state 读写/合并/原子写；theme/sessionRegistry 双写与迁移。
- **Exit**：三平台路径测试；清缓存恢复测试。

### M3 服务管理（3–5 天）
- OpencodeService 全流程 + 设置页状态/日志/重装/离线兜底。
- QqService（按 M0 结论）+ 首次启动向导 + QQ 登录引导。
- **Exit**：全新机器安装后，双击 → 向导 → 分析成功；断网/下载失败有明确恢复路径。

### M4 正确性修复（2–3 天）
- 分页、时区、并发清理、会话恢复、错误处理。
- **Exit**：新增单测全绿；真实 NapCat 联调通过日期范围拉取。

### M5 安全加固（2–3 天）
- token/Host/Origin、CSP、fuses、safeStorage、请求体上限、路径校验、日志脱敏。
- **Exit**：Electron 安全清单逐项通过；恶意网页无法调用本地 API。

### M6 发布工程（3–5 天）
- electron-builder 三平台安装包；CI 矩阵；draft release 汇总；自动更新。
- 签名/公证按是否有证书决定；无证书时提供手动放行说明。
- **Exit**：三平台干净机器安装/升级冒烟通过。

### M7 验收与文档（2–3 天）
- Playwright Electron E2E；README/用户指南/故障排查/QQ 风险提示；分支保护。
- **Exit**：新用户按文档完成首次使用；CI 全绿。

## 8. 安全基线

- BrowserWindow：`contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`、`webviewTag: false`。
- 导航：`will-navigate` 按 origin 精确比较；`setWindowOpenHandler` 默认 deny；外链 https allowlist。
- CSP：`default-src 'self'`；`connect-src 'self' http://127.0.0.1:*`；生产不加 `unsafe-eval`。
- 本地 server：仅 `127.0.0.1`；随机端口；token 常量时间比较；Host/Origin 校验；OPTIONS 预检；32MB 请求体上限。
- 文件：固定根目录 + `resolve` 包含校验 + `basename`；拒绝 symlink；每次分析独立目录。
- 凭据：`safeStorage` 加密；renderer 只见掩码；日志脱敏。
- 进程：只用 `spawn/execFile` 参数数组；不 `shell: true`；不按端口杀；只杀自有 PID。
- Fuses：`runAsNode: false`、`onlyLoadAppFromAsar: true`、`enableEmbeddedAsarIntegrityValidation: true` 等。
- 更新：HTTPS + 代码签名校验；不跨主版本；不降级。

## 9. 待决事项

1. ~~QQ 接入最终选择~~：已定 **NapCat**（见 `docs/superpowers/notes/2026-11-05-qq-decision.md`）。
2. ~~macOS/Linux 可用性~~：NapCat 官方支持 macOS 12+/Linux x64；采用引导安装，不代改 QQ。
3. 代码签名证书：Windows（Azure Trusted Signing/OV/EV）、Apple Developer ID + 公证；无证书的降级策略。
4. 是否提供离线安装包（捆绑 Opencode，约 +60–80MB；QQ 服务视方案）。
5. 最低系统版本（Electron 45 要求 macOS 13+；Windows 10+；Linux glibc 基线）。
6. 是否保留“外部服务”模式（用户已有 NapCat/opencode）。
7. 旧 Web 版 localStorage/会话数据迁移范围。

## 10. 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| NapCat 安装器需要 QQ/GUI/管理员权限 | 自动安装不可行 | 引导安装；用户确认后启动官方安装器；检测已有安装 |
| QQ 登录/账号风险 | 用户账号受限 | 首次启动显著提示；不自动登录；不存储密码 |
| NapCat 非商业许可 | 商业分发/内置打包不合规 | 不打包；只从官方地址下载；附许可全文；商业分发前取得作者授权 |
| 服务下载被墙/失败 | 首次启动不可用 | GitHub + npm + 镜像 + 手动路径 + 离线包 |
| 代码签名缺失 | SmartScreen/Gatekeeper 拦截 | 购买证书；无证书时提供放行文档；优先签名 macOS |
| Opencode 体积大 | 下载/磁盘/启动慢 | 显示进度；保留上一版本；离线包可选 |
| `app://` 跨源/CORS 差异 | API 调用失败 | 精确 Origin 允许 + token；M1 早验证 |
| Ubuntu 24.04 AppImage 沙箱 | 无法启动 | 干净 VM 冒烟；必要时提示 deb 或调整 |
| 旧会话按 cwd 划分 | 升级后会话消失 | 保留旧 cwd 或做迁移；M2 验证 |
| Electron 45 抬升 macOS 最低版本 | 旧 Mac 用户流失 | 发布说明标注；必要时评估 Electron 44 |

## 11. 验证计划

- 单元：分页、日期分组、路径、server 路由、ServiceManager、app-state、sessionRegistry。
- 集成：Hono server + mock NapCat/opencode；SSE 流式代理。
- E2E（Playwright Electron）：首启向导、服务状态、拉列表、分析、追问、重启、退出清理。
- 打包：Windows NSIS、macOS DMG/zip（签名/公证）、Linux AppImage/deb；干净 VM 安装/升级。
- 安全：Electron 安全清单、恶意网页调用本地 API、路径穿越、超大请求体。
- 回归：现有 19 个测试保持通过；新增测试不降低覆盖率。
