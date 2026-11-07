# Chatnip Desktop Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Chatnip 从“Vite dev server 即后端”的本地 Web 应用改造成可分发的 Electron 桌面应用（Windows/Linux/macOS），由 App 管理 Opencode 与 QQ 接入服务，并修复 master 已识别的正确性/安全/跨平台问题。

**Architecture:** Electron 主进程承载窗口、`app://chatnip` 静态协议、本地 API server 与 ServiceManager；renderer 沿用现有 React 构建，生产加载 `app://chatnip/`，通过 `apiBase + token` 调用 `127.0.0.1` 上的 Hono server；Vite dev server 仅供开发热更新。Opencode 固定 V1.19.5 运行期下载；QQ 接入服务按 M0 决策自动安装或引导安装。

**Tech Stack:** Electron 45.2.3、electron-vite 6.0.0、electron-builder 26.18.x、electron-updater 6.8.x、Hono + @hono/node-server、React 19、Vite 6.4.5、TypeScript、Vitest、Playwright Electron。

**Spec:** `docs/superpowers/specs/2026-11-05-desktop-distribution-design.md`

## Global Constraints

- Electron `45.2.3`；electron-vite `6.0.0`；electron-builder `26.18.x`；electron-updater `6.8.x`；Vite `6.4.5`；React `19`；保留现有 TypeScript strict 配置。
- Opencode CLI 与 `@opencode-ai/sdk` 都锁 `1.19.5`；不跟随 V2，不自动跨主版本升级。
- macOS 最低 13；Windows 10+；Linux x64（AppImage 为主，deb 为辅）。
- Windows `userData` 固定为 `%LOCALAPPDATA%\chatnip`（兼容旧数据）；macOS/Linux 用 `app.getPath('userData')`。
- 生产 renderer origin 固定为 `app://chatnip`；本地 API 仅绑定 `127.0.0.1` 随机端口，所有 `/api`、`/__api` 请求必须带 `X-Chatnip-Token`。
- 不允许明文存储 QQ/Opencode 凭据；不允许 `shell: true`；不允许按端口杀进程；只管理自己 spawn 的 PID。
- 文件写入必须限制在 `<userData>/chat-history/<analysisId>/` 内；每次分析独立目录。
- GPLv3：分发安装包时同步提供对应源码与第三方许可清单。
- **提交策略**：除非用户明确授权，不执行 `git commit` / `git push`；计划中的“Commit”步骤一律视为“检查点”，等用户授权后再提交。

## Review Focus

1. **全新机器首次启动**：没有 Opencode、没有 QQ 服务、没有网络时，必须进入可恢复的首次启动向导，而不是白屏/崩溃。
2. **下载与校验失败**：断网、半包、SHA-256 不匹配、磁盘不足时，不得留下坏二进制、不得卡死启动流程。
3. **非 Windows 路径**：包含空格、中文、非 ASCII 的用户名路径下，聊天文件写入与 Opencode file URL 必须可用。
4. **并发分析**：两个分析同时运行时，清理其中一个不得删除另一个的临时文件。
5. **本地恶意页面/进程**：任意网页或本机其他程序不能调用本地 API、读取聊天文件或拿到 token。

---

## File Structure

```text
electron.vite.config.ts              # main/preload/renderer 三段构建
electron-builder.yml                 # 三平台打包/更新配置
electron/
├─ main/
│  ├─ index.ts                       # app 生命周期、单实例、启动顺序
│  ├─ window.ts                      # BrowserWindow + 安全配置
│  ├─ security.ts                    # 导航/权限/CSP/fuses
│  ├─ protocol.ts                    # app://chatnip 静态服务 + SPA fallback
│  ├─ paths.ts                       # userData/旧数据迁移/目录布局
│  ├─ server/
│  │  ├─ index.ts                    # Hono app + 监听 127.0.0.1:0
│  │  ├─ auth.ts                     # token/Host/Origin/OPTIONS
│  │  └─ routes/{appState,files,napcat,opencode}.ts
│  ├─ services/
│  │  ├─ opencode/{manifest,download,manager}.ts
│  │  └─ qq/{types,manager,napcat}.ts
│  └─ ipc.ts                         # 服务状态/安装/重启 IPC
├─ preload/index.ts                  # contextBridge: apiBase/token/version/服务事件
└─ __tests__/                        # Electron 侧 Vitest 单测
src/
├─ api/runtime.ts                    # apiBase + token + apiFetch
├─ lib/historyPager.ts               # 历史分页纯逻辑
├─ lib/dateGroups.ts                 # 本地日期分组
├─ pages/SetupPage.tsx               # 首次启动向导
└─ store/bootstrap.ts                # app-state 启动恢复
scripts/gen-opencode-manifest.mjs    # 构建期生成固定版本 manifest
e2e/{first-run,analysis}.spec.ts     # Playwright Electron
```

---

### Task 1: Electron 外壳与构建链冒烟（M0）

**Files:**
- Create: `electron.vite.config.ts`, `electron/main/index.ts`, `electron/main/window.ts`, `electron/preload/index.ts`, `tsconfig.node.json`
- Modify: `package.json`, `.gitignore`, `eslint.config.mjs`

**Interfaces:**
- Produces: `createMainWindow(): BrowserWindow`；npm scripts `dev:electron`、`build:electron`、`package`。

- [x] **Step 1: 安装并锁定依赖**

```bash
npm i -D electron@45.2.3 electron-vite@6.0.0 electron-builder@26.18.0 electron-updater@6.8.11
```

- [x] **Step 2: 写 `electron.vite.config.ts`**（已完成；renderer 显式 `minify: 'esbuild'`，否则 electron-vite 默认不压缩，产物从 849 kB 涨到 2.07 MB）

main/preload 输入分别指向 `electron/main/index.ts`、`electron/preload/index.ts`；renderer `root` 保持仓库根、input 为 `index.html`、alias `@` → `src`；输出 `out/{main,preload,renderer}`。

- [x] **Step 3: 写最小主进程与窗口**（已完成；`sandbox: true` + CJS preload + `import.meta.dirname`）

`electron/main/index.ts`：`app.whenReady()` 后 `createMainWindow()`；dev 加载 `process.env.ELECTRON_RENDERER_URL`，生产暂加载 `out/renderer/index.html`。`window.ts` 使用 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`、`preload: out/preload/index.cjs`。

- [x] **Step 4: 验证 dev 窗口**（已完成：Electron 45 真实窗口截图显示 `/chats` 页面正常渲染；NapCat 未启动时的错误 toast 符合预期）

Run: `npm run dev:electron`
Expected: 窗口出现现有 Chatnip `/chats` 页面；DevTools 无红色错误。

- [x] **Step 5: 验证构建产物**（已完成：`out/main/index.js`、`out/preload/index.cjs`、`out/renderer/index.html` 均生成。**已知问题**：`loadFile` 加载生产产物为白屏——`/assets` 绝对路径 + BrowserRouter 在 `file://` 下失效，由 M1 Task 8 的 `app://` 协议 + SPA fallback 解决）

Run: `npm run build:electron`
Expected: `out/main/index.js`、`out/preload/index.cjs`、`out/renderer/index.html` 均存在；`npx electron .` 能打开窗口。

- [x] **Step 6: 检查点**（已完成：`tsc -p tsconfig.node.json`、`npm run typecheck`、`npm run lint`、`npm test` 全绿；未提交）

`npm run typecheck && npm run lint` 通过；暂不提交（等待用户授权）。

---

### Task 2: QQ 接入方案决策记录（M0）

**Files:**
- Create: `docs/superpowers/notes/2026-11-05-qq-decision.md`

**Interfaces:**
- Produces: 后续 Task 12 使用的 provider 选择、安装策略、平台矩阵、登录流程、分页契约。

- [x] **Step 1: 汇总调研结论**（已完成：见 `docs/superpowers/notes/2026-11-05-qq-decision.md`；NapCat 官方支持 Windows/Linux/macOS 12+，采用引导安装，非商业许可，不内置打包）

记录 NapCat 与 SnowLuma：支持的 OS、前置依赖（QQ NT/注入）、发布物与自动下载可行性、许可证、登录方式、`get_group_msg_history` 的锚点参数（`message_seq` vs `message_id`）、`count` 上限、macOS 是否可用。

- [x] **Step 2: 做选择**（已完成：主 provider = NapCat；安装策略 = 引导安装为主、自动下载为辅；三平台均支持；macOS 不代改 QQ）

明确：主 provider（默认 NapCat；macOS 不支持时的降级）；安装策略（自动下载 / 引导安装 / 外部服务）；是否支持双 provider；macOS 是否只提供 UI/外部服务模式。

- [x] **Step 3: 冻结契约**（已完成：`QqProvider` 接口、配置字段、`message_seq = 上一批最旧 message_id`、四重停止条件）

写出 `QqProvider` 的 detect/start/health/webUiUrl 契约与配置字段；写出历史分页的正确请求参数与停止条件。

- [x] **Step 4: 自检**（已完成：平台矩阵/安装方式/许可证/分页语义均有来源；待实测项单列）

每条结论必须有来源（官方文档/源码/Release 链接/日期）；不确定项单列“需实测”。

---

### Task 3: 路径模块与旧数据迁移

**Files:**
- Create: `electron/main/paths.ts`, `electron/main/__tests__/paths.test.ts`

**Interfaces:**
- Produces:
```ts
export interface AppPaths {
  userData: string; chatHistory: string; appState: string;
  logs: string; bin: string; workspace: string; config: string;
}
export function resolveUserDataDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  appGetPath: (name: string) => string,
): string
export function createAppPaths(userData: string): AppPaths
export async function migrateLegacyData(
  paths: AppPaths, platform: NodeJS.Platform, env: NodeJS.ProcessEnv,
): Promise<void>
```
- Consumes: 无。

- [ ] **Step 1: 写失败测试**

断言：win32 且 `LOCALAPPDATA=C:\Users\u\AppData\Local` → `...\chatnip`；darwin/linux 返回 `appGetPath('userData')`；`createAppPaths` 生成 7 个子路径；旧 `app-state.json`/`chat-history` 存在时被复制且幂等。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run electron/main/__tests__/paths.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

纯函数 + `fs.promises`；迁移使用 `cp({ recursive: true })`，目标已存在则跳过；Windows 旧目录不存在时不为空创建。

- [ ] **Step 4: 运行测试确认通过**

Run: 同上；Expected: PASS。

---

### Task 4: Server 基础、鉴权与 app-state 路由

**Files:**
- Create: `electron/main/server/index.ts`, `electron/main/server/auth.ts`, `electron/main/server/routes/appState.ts`, `electron/main/__tests__/server-appstate.test.ts`
- Modify: `package.json`（新增 `hono`、`@hono/node-server`）

**Interfaces:**
- Produces:
```ts
export interface ServerDeps { paths: AppPaths; fetchImpl: typeof fetch; token: string; }
export function createServerApp(deps: ServerDeps): Hono
export function createAuthMiddleware(token: string, allowedOrigins: string[]): MiddlewareHandler
export function startServer(app: Hono): Promise<{ port: number; close(): Promise<void> }>
```
- Consumes: Task 3 的 `AppPaths`。

- [ ] **Step 1: 写失败测试**

用 `app.request()` 断言：无 token → 401；错误 Origin → 403；正确 token POST `/__api/app-state/save` → 200；GET `/__api/app-state/load` 返回刚存数据；损坏 JSON 返回 `{}`；`Content-Length > 32MB` → 413。

- [ ] **Step 2: 运行确认失败**：`npx vitest run electron/main/__tests__/server-appstate.test.ts` → FAIL。

- [ ] **Step 3: 实现 auth + app-state**

`auth.ts` 使用 `crypto.timingSafeEqual`；Host 仅允许 `127.0.0.1:<port>`/`localhost:<port>`；Origin 仅允许 `app://chatnip`、`http://localhost:5173`；`OPTIONS` 返回精确允许头。app-state 写入用 `.tmp` + `rename` 原子替换。

- [ ] **Step 4: 运行测试确认通过** → PASS。

---

### Task 5: 聊天文件路由（每次分析独立目录）

**Files:**
- Create: `electron/main/server/routes/files.ts`, `electron/main/__tests__/server-files.test.ts`
- Modify: `src/api/fileWriter.ts`（调用方传 `analysisId`）

**Interfaces:**
- Produces:
```ts
// POST /__api/chat-history/write { analysisId, filename, content } -> { ok, url }
// DELETE /__api/chat-history/clean { analysisId } -> { ok }
export function createFilesRoutes(paths: AppPaths): Hono
export function analysisDir(paths: AppPaths, analysisId: string): string
```
- Consumes: `AppPaths`；Task 14 生成的 `analysisId`。

- [ ] **Step 1: 写失败测试**

断言：写入 `analysisId=A` 后文件在 `chat-history/A/`；`../`、绝对路径、symlink 被拒；删除 A 不影响 B；内容超上限 → 413。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**

`analysisId` 仅允许 `[A-Za-z0-9_-]{1,64}`；`filename` 仅 `path.basename` 且无分隔符；`resolve` 后必须 `startsWith(analysisDir + sep)`；`lstat` 拒绝 symlink；URL 用 `pathToFileURL()`。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 6: NapCat 代理与配置路由

**Files:**
- Create: `electron/main/server/routes/napcat.ts`, `electron/main/__tests__/server-napcat.test.ts`
- Modify: 现有 `src/api/napcat.ts` 仅改 base 注入（Task 9）

**Interfaces:**
- Produces: `createNapcatRoutes(deps: { fetchImpl: typeof fetch; readConfig(): QqConfig }): Hono`；`GET /api/napcat/*`、`POST /api/napcat/*` 透传；`POST /__api/napcat-config` 保存配置。
- Consumes: `QqConfig`（Task 12 定义；本任务先用 `{ baseUrl: string; accessToken?: string }`）。

- [ ] **Step 1: 写失败测试**

fake fetch 断言：目标 URL = `baseUrl + path`；注入 `Authorization: Bearer <token>`；上游 500 → 502 `{ error }`；30s 超时（fake timer）→ 502。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**：`AbortSignal.timeout(30_000)`；仅允许 http/https baseUrl；头部过滤 `host/connection/content-length`。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 7: Opencode 代理与重启路由（含 SSE）

**Files:**
- Create: `electron/main/server/routes/opencode.ts`, `electron/main/__tests__/server-opencode.test.ts`
- Modify: `src/api/opencode.ts`（base 注入，Task 9）

**Interfaces:**
- Produces:
```ts
export function createOpencodeRoutes(deps: {
  baseUrl: string; password: string;
  fetchImpl: typeof fetch;
  restart(): Promise<{ ok: boolean; error?: string }>;
}): Hono
```
- Consumes: Task 11 的 `OpencodeService`（通过 `restart` 回调）。

- [ ] **Step 1: 写失败测试**

断言：透传路径与 body；注入 Basic auth；`text/event-stream` 响应按 chunk 流式返回（不 buffer）；`POST /__api/opencode/restart` 返回 `restart()` 结果；restart 抛错 → 500 `{ok:false}`。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**：`return new Response(upstream.body, { headers })`；剥离 renderer 的 `authorization`；非流式仍可整包返回。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 8: Electron 主进程 — app:// 协议、窗口与 server 生命周期

**Files:**
- Create: `electron/main/protocol.ts`, `electron/main/security.ts`; Modify: `electron/main/index.ts`, `electron/main/window.ts`, `electron/preload/index.ts`

**Interfaces:**
- Produces:
```ts
export function registerAppScheme(): void          // 必须在 app.ready 前调用
export function registerAppProtocol(rendererDir: string): void
export async function bootstrap(): Promise<void>   // paths + server + services + window
```
- Consumes: Task 4 `startServer`；Task 3 `AppPaths`。

- [ ] **Step 1: 注册 scheme 并实现静态服务**

`protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }])`；`app://chatnip/<path>` 映射 `out/renderer/<path>`；无扩展名路径回退 `index.html`；设置 CSP 头。

- [ ] **Step 2: 主进程启动顺序**

`app.requestSingleInstanceLock()` → `app.setPath('userData', ...)`（win32 用 LOCALAPPDATA）→ `migrateLegacyData` → 启动 Hono server → 注册协议 → 创建窗口 → 异步启动 Opencode/QQ 服务。

- [ ] **Step 3: 验证**

Run: `npm run build:electron && npx electron .`
Expected: 窗口加载 `app://chatnip/chats`，React 正常渲染；`fetch('/api/...')` 命中本地 server（可用 DevTools Network 确认）。

- [ ] **Step 4: 检查点**：`npm run typecheck && npm run lint` 通过。

---

### Task 9: Renderer API 运行时（apiBase + token）

**Files:**
- Create: `src/api/runtime.ts`, `src/api/__tests__/runtime.test.ts`
- Modify: `src/api/napcat.ts`, `src/api/opencode.ts`, `src/api/appState.ts`, `src/api/fileWriter.ts`, `src/pages/SettingsPage.tsx`

**Interfaces:**
- Produces:
```ts
export function getApiBase(): string       // window.chatnip?.apiBase ?? ''
export function getApiToken(): string      // window.chatnip?.apiToken ?? ''
export function apiUrl(path: string): string
export function apiHeaders(extra?: HeadersInit): HeadersInit
export function apiFetch(path: string, init?: RequestInit): Promise<Response>
```
- Consumes: Task 8 的 preload 暴露。

- [ ] **Step 1: 写失败测试**

断言：有 `window.chatnip` 时 `apiUrl('/api/napcat') = 'http://127.0.0.1:PORT/api/napcat'` 且 header 含 token；无时返回相对路径且无 token（dev 模式）。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现并替换 6 处调用**

`napcat.ts` 的 axios `baseURL: apiUrl('/api/napcat')` + `X-Chatnip-Token`；`opencode.ts` 的 SDK `baseUrl: apiUrl('/api/opencode')`，SDK 需支持自定义 fetch（用 `fetch: (input, init) => apiFetch(...)`）或改用 axios/fetch 封装；`appState/fileWriter/SettingsPage` 改用 `apiFetch`。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 10: Opencode manifest 与下载器

**Files:**
- Create: `scripts/gen-opencode-manifest.mjs`, `resources/opencode-manifest.json`, `electron/main/services/opencode/{manifest,download}.ts`, `electron/main/__tests__/opencode-download.test.ts`

**Interfaces:**
- Produces:
```ts
export interface OpencodeManifest { version: string; sdk: string; targets: Record<string, { url: string; sha256: string; size: number; archive: 'zip'|'tar.gz'; binary: string }>; }
export function loadManifest(): OpencodeManifest
export async function downloadOpencode(m: OpencodeManifest, targetKey: string, destDir: string, fetchImpl?: typeof fetch): Promise<string>
```
- Consumes: 无。

- [ ] **Step 1: 写失败测试**

用本地 fixture 文件断言：SHA-256 不匹配时抛错且删除 `.part`；匹配时解压/落盘并返回可执行路径；中断后重启可从 `.part` 续传（Range）。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**

构建期脚本从 GitHub Release API 读取 asset `digest` 生成 manifest；运行期 `electron.net.fetch`（可注入）下载；解压用 `tar`/`yauzl`（或 `adm-zip`）；原子 rename；`chmod 0755`。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 11: OpencodeService 生命周期

**Files:**
- Create: `electron/main/services/opencode/manager.ts`, `electron/main/__tests__/opencode-manager.test.ts`
- Modify: `electron/main/index.ts`（启动服务）

**Interfaces:**
- Produces:
```ts
export type ServiceState = 'stopped'|'installing'|'starting'|'ready'|'error'
export interface OpencodeService {
  ensureInstalled(): Promise<string>
  start(): Promise<{ port: number; password: string }>
  stop(): Promise<void>
  restart(): Promise<{ ok: boolean; error?: string }>
  state(): { state: ServiceState; version?: string; error?: string }
}
export function createOpencodeService(deps: {
  paths: AppPaths; spawn: typeof spawn; fetchImpl: typeof fetch;
  manifest?: OpencodeManifest;
}): OpencodeService
```
- Consumes: Task 3、Task 10。

- [ ] **Step 1: 写失败测试**

fake spawn/fetch 断言：健康检查轮询到 `{healthy:true,version:'1.19.5'}` 才 ready；子进程提前退出 → error + stderr 记录；重启先 stop 再 start；退出清理只 kill 自己的 PID。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**：随机端口（`net.listen(0)` 后关闭）；`OPENCODE_SERVER_PASSWORD` 环境变量；cwd=`paths.workspace`；macOS PATH 增补；日志轮转。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 12: QQ provider 与 QqService

**Files:**
- Create: `electron/main/services/qq/{types,manager,napcat}.ts`, `electron/main/__tests__/qq-manager.test.ts`

**Interfaces:**
- Produces:
```ts
export interface QqConfig { provider: 'napcat'|'snowluma'; baseUrl: string; accessToken?: string; installDir?: string; }
export interface QqProvider {
  id: 'napcat'|'snowluma'
  detect(): Promise<{ installed: boolean; path?: string; version?: string }>
  start(config: QqConfig): Promise<import('child_process').ChildProcess>
  health(config: QqConfig): Promise<boolean>
  webUiUrl(config: QqConfig): string | null
}
export interface QqService { detect(); configure(c: QqConfig); start(); stop(); health(); webUiUrl(); state(); }
export function createQqService(deps: { paths: AppPaths; spawn: typeof spawn; fetchImpl: typeof fetch; provider: QqProvider }): QqService
```
- Consumes: Task 2 决策记录、Task 3 `AppPaths`。

- [ ] **Step 1: 写失败测试**

fake provider 断言：未安装时 `detect` 返回 `{installed:false}`；配置写入后 `start` 调用 provider.start；health 失败 → error 状态；stop 只 kill 自己的子进程。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**

按 Task 2 决策实现 `NapCatProvider`（必要时 `SnowLumaProvider`）；配置存 `userData/config/qq.json`，token 用 `safeStorage` 加密；WebUI URL 由 provider 提供；健康检查调用 OneBot `get_login_info` 或 provider 的等价端点。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 13: 首次启动向导与 IPC

**Files:**
- Create: `electron/main/ipc.ts`, `src/pages/SetupPage.tsx`, `src/pages/__tests__/SetupPage.test.tsx`; Modify: `electron/preload/index.ts`, `src/router.tsx`

**Interfaces:**
- Produces: preload `window.chatnip.services`（`getStatus`、`install`、`start`、`restart`、`openWebUi`、`onStatus`）；路由 `/setup`。
- Consumes: Task 11/12 服务实例。

- [ ] **Step 1: 写失败测试**

RTL 断言：首次启动且服务未就绪 → 渲染向导；点击“安装 Opencode”调用 IPC；服务 ready 后“进入 Chatnip”可用；错误状态显示可行动文案。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**：`ipcMain.handle` 白名单通道；`contextBridge` 只暴露窄接口；向导步骤（Opencode → QQ 安装/定位 → 登录 → 完成）。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 14: 历史消息分页修复

**Files:**
- Create: `src/lib/historyPager.ts`, `src/lib/__tests__/historyPager.test.ts`
- Modify: `src/pages/NewAnalysisPage.tsx`, `src/types/index.ts`

**Interfaces:**
- Produces:
```ts
export interface HistoryPage { messages: NapCatMessage[]; nextAnchor?: number; done: boolean }
export async function fetchAllHistory(
  fetchPage: (anchor?: number) => Promise<NapCatMessageHistory>,
  opts: { batchSize: number; maxBatches: number; rangeFrom: number },
): Promise<NapCatMessage[]>
```
- Consumes: Task 2 的契约（锚点字段、count 上限、排序）。

- [ ] **Step 1: 写失败测试**

用 fake fetch 断言：按锚点推进；跨批按 `message_id` 去重；返回 `< batchSize` 时结束；锚点不前进（服务端忽略参数）时立即停止并告警；达到 `maxBatches` 时返回已拉取数据。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**

按 Task 2 契约选择锚点字段；`BATCH_SIZE` 不超过 provider 上限（NapCat 1000 / SnowLuma 200）；`NapCatMessage` 增加可选 `message_seq?: number`；停止条件改为“空批次 / 已越过 rangeFrom / 锚点未前进 / maxBatches”。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 15: 本地日期分组与并发清理

**Files:**
- Create: `src/lib/dateGroups.ts`, `src/lib/__tests__/dateGroups.test.ts`; Modify: `src/pages/NewAnalysisPage.tsx`, `src/api/fileWriter.ts`

**Interfaces:**
- Produces: `localDateKey(ts: number): string`（`YYYY-MM-DD`，本地时区）；`writeChatFile(analysisId, filename, content)`；`cleanupChatHistory(analysisId)`。
- Consumes: Task 5。

- [ ] **Step 1: 写失败测试**

断言：`TZ=Asia/Shanghai` 下 `2026-01-01T00:30+08:00` → `2026-01-01`；UTC 下同日不同结果；两个 analysisId 的清理互不影响。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**：`getFullYear/getMonth/getDate` 手工拼接；`crypto.randomUUID()` 生成 analysisId；清理只删自己的目录。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 16: app-state 启动恢复与会话重建

**Files:**
- Create: `src/store/bootstrap.ts`, `src/store/__tests__/bootstrap.test.ts`; Modify: `src/store/settingsSlice.ts`, `src/store/sessionRegistry.ts`, `src/hooks/useOpencode.ts`

**Interfaces:**
- Produces:
```ts
export async function loadAndMergeState(): Promise<{ settings?: unknown; sessions?: Record<string, SessionInfo> }>
export function mergeRemoteSessions(remote: SessionInfo[], registry: Record<string, SessionInfo>): SessionInfo[]
```
- Consumes: `loadAppState`、Task 4 的 app-state 路由。

- [ ] **Step 1: 写失败测试**

断言：app-state 有数据时优先于 localStorage；损坏数据回退默认值；远端会话不在注册表时用远端标题/时间补齐；localStorage 抛错不崩溃。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**：启动时 `loadAppState()` → sanitize → 合并；sessionRegistry 写入加 try/catch；未知会话以只读元数据展示。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 17: 安全加固

**Files:**
- Create: `electron/main/__tests__/security.test.ts`; Modify: `electron/main/security.ts`, `electron/main/window.ts`, `electron/main/server/auth.ts`, `electron/main/services/qq/manager.ts`, `electron-builder.yml`

**Interfaces:**
- Produces: `buildWebPreferences(): WebPreferences`；`isAllowedNavigation(url: string): boolean`；`safeStorage` 加解密封装。

- [ ] **Step 1: 写失败测试**

断言：非白名单 origin 的导航被拒；`file://`/`javascript:`/`data:` 被拒；token 比较使用常量时间；日志脱敏 Authorization/token。

- [ ] **Step 2: 确认失败** → FAIL。

- [ ] **Step 3: 实现**

CSP 响应头；`setWindowOpenHandler` deny；`will-navigate` origin 精确比较；权限请求默认拒绝；`safeStorage` 加密 token；请求体 32MB 限制；路径/symlink 校验；fuses 配置。

- [ ] **Step 4: 确认通过** → PASS。

---

### Task 18: 打包与发布 CI

**Files:**
- Create: `electron-builder.yml`, `.github/workflows/release.yml`, `.github/workflows/ci.yml`（修改矩阵）; Modify: `package.json`

**Interfaces:**
- Produces: NSIS/DMG+zip/AppImage+deb 安装包；`latest*.yml`；三平台 CI。

- [ ] **Step 1: 配置 electron-builder**

`appId: com.chatnip.app`；`productName: Chatnip`；`directories.output: release`；`files: out/**`；`extraResources: resources/**`；`asar: true`；`electronFuses` 按设计文档；macOS hardenedRuntime + entitlements。

- [ ] **Step 2: 配置 CI 矩阵**

`windows-latest --win`、`macos-latest --mac --universal`、`ubuntu-latest --linux`；PR 只构建不发布；tag `v*` 创建 draft release 并汇总 artifact。

- [ ] **Step 3: 验证**

Run: `npx electron-builder --dir`（本机）
Expected: `release/*-unpacked` 可启动；三平台 CI 产出 artifact。

- [ ] **Step 4: 检查点**：不提交 `release/`；`git status` 干净。

---

### Task 19: E2E、文档与验收

**Files:**
- Create: `e2e/first-run.spec.ts`, `e2e/analysis.spec.ts`, `playwright.config.ts`, `docs/USER_GUIDE.md`; Modify: `README.md`, `docs/BRANCH_PROTECTION.md`

- [ ] **Step 1: E2E 首启向导**

Playwright Electron 启动打包产物；mock 下载失败 → 显示错误与重试；mock 成功 → 进入 `/chats`。

- [ ] **Step 2: E2E 分析主流程**

mock NapCat/opencode 服务；选择聊天 → 日期 → 开始分析 → 详情页出现维度卡；追问成功/空回复/失败回滚三种分支。

- [ ] **Step 3: 文档**

README 重写为“下载安装 → 首次启动 → QQ 登录 → 开始分析 → 故障排查”；显著提示 QQ 账号风险；附 GPLv3 源码获取方式与第三方许可。

- [ ] **Step 4: 最终验证**

Run: `npm run typecheck && npm run lint && npm test && npm run build:electron && npx playwright test`
Expected: 全绿；三平台安装包在干净 VM 冒烟通过。

---

## Self-Review

- **Spec coverage**：设计文档 §2 Goals 由 Task 1/8/11/12/18 覆盖；§5 局限 1–13 分别映射到 Task 4–17、19；§8 安全基线由 Task 4/17 覆盖；§9 待决事项由 Task 2 冻结。
- **Type consistency**：`AppPaths`、`QqConfig`、`OpencodeManifest`、`ServiceState` 在后续任务中复用同一命名；`apiUrl/apiFetch` 与 renderer 改造一致。
- **Review Focus 测试落点**：首启失败（Task 13 E2E）、下载校验失败（Task 10）、非 Windows 路径（Task 3/5/15）、并发清理（Task 5/15）、恶意本地调用（Task 4/17）。
- **未覆盖**：代码签名/公证的具体证书获取属于外部采购，Task 18 只实现条件分支与文档；离线安装包（捆绑 Opencode）作为 Task 18 的可选子项，默认不启用。

---

## Progress（2026-11-06）

已完成（核心实现，未提交）：

- **Task 1–2**：Electron 构建链冒烟；NapCat 决策记录（`docs/superpowers/notes/2026-11-05-qq-decision.md`）。
- **Task 3**：`electron/main/paths.ts`；userData 解析、旧数据迁移、目录布局。
- **Task 4–7**：Hono server + token/Host/Origin 鉴权、CORS、32MB 限制；app-state 原子读写；聊天文件按 `analysisId` 隔离；NapCat 代理；Opencode 代理（SSE 流式）+ 重启。
- **Task 8**：`app://chatnip` 协议 + SPA fallback + CSP；主进程启动顺序、单实例、退出清理；生产 renderer 实测不再白屏。
- **Task 9**：renderer `apiBase + token`；NapCat/Opencode/appState/fileWriter/SettingsPage 全部切换；`app://` → 本地 API 鉴权/CORS 实测通过。
- **Task 10–11**：Opencode manifest 生成脚本（v1.19.5，6 平台 SHA-256）；下载/校验/解压/启动/健康检查/重启；实测状态“运行中 · v1.19.5”。
- **Task 12–13**：NapCat QqService（检测/配置/safeStorage/健康检查/WebUI/引导安装）；首次启动向导 `/setup` + IPC 服务状态。
- **Task 14–16**：历史分页抽离 + 去重/四重停止条件；本地日期分组；每次分析独立目录；app-state 启动恢复；远端会话重建。
- **Task 17**：Electron 安全基线（contextIsolation/sandbox、导航/权限、CSP、fuses、safeStorage、请求体限制、路径校验）。
- **Task 18**：electron-builder 三平台配置、entitlements、自动更新接入、三平台 Release CI；CI 增加 `typecheck:node`/`build:electron`。
- **Task 19（部分）**：README 重写为桌面版；新增 `historyPager`/`dateGroups` 单测（总计 27 用例通过）。

待办：

- Playwright Electron E2E（首启/分析/追问）。
- Windows/macOS 干净机器安装与升级验证；代码签名/公证。
- app.asar 体积已从 261MB 裁剪到 7.6MB（renderer-only 依赖移入 devDependencies，仅保留主进程运行时依赖）。
- 应用图标（build/icon.ico/icns/png）。
- NapCat 真实登录、深翻页（>5000 条）、WebUI 端口探测联调。
- 离线安装包（可选）。
