# NapCat 集成决策记录

- 日期：2026-11-05
- 状态：已决策（用户选择 NapCat；按默认策略）
- 上游版本基线：NapCat `v4.18.42`（2026-10-30 发布）

## 1. 决策

- QQ 接入 provider：**NapCat**（不做 SnowLuma 双支持；SnowLuma 仅在将来需要时作为同接口的备选适配器）。
- 安装策略：**引导安装为主，自动下载为辅**；绝不把 NapCat 打包进 Chatnip 安装包。
- 登录方式：通过 NapCat WebUI 扫码登录 QQ；Chatnip 负责打开 WebUI 并轮询健康状态。
- 平台范围：Windows x64、Linux x64、macOS 12+（Intel/Apple Silicon）。三平台均按各自官方安装方式引导。

## 2. 平台支持矩阵

| 平台 | 官方支持 | 安装方式 | Chatnip 集成策略 |
|---|---|---|---|
| Windows 10/11 x64 | 是 | `NapCat.Shell.Windows.OneKey.zip`（自动部署 QQ，需 GUI/管理员）、`NapCat.Shell.zip`（需已装 QQ）、`NapCat.Shell.Windows.Node.zip` | 引导下载 OneKey；可选自动下载 zip 并启动 `NapCatInstaller.exe`；检测已有 NapCat/QQ |
| Linux x64 | 是 | `napcat.sh` 一键安装（推荐，支持 Docker 或本机 QQ + Xvfb）、手动安装、Docker Compose | 引导执行官方脚本；检测 QQ/NapCat/Docker；提供端口/token 配置与健康检查 |
| macOS 12+（Intel/Apple Silicon） | 是 | 先安装 `/Applications/QQ.app`，再运行 `NapCat-Mac-Installer`（需授权修改 QQ 入口） | 引导安装 QQ + Mac Installer；检测安装结果；不自动修改 QQ |

来源：NapCat 官网 `napcat.napneko.icu`、NapCatDocs `src/guide/boot/Shell.md`（Windows/Linux/macOS 章节）、`src/guide/boot/release.md`。

## 3. 发布物与自动下载

- 最新 Release 资产（v4.18.42）：
  - `NapCat.Shell.zip` — 通用 Shell，需另装 QQ
  - `NapCat.Shell.Windows.OneKey.zip` — Windows 一键安装器
  - `NapCat.Shell.Windows.Node.zip` — Windows Node 运行包
  - `NapCat.Framework.zip` — LiteLoaderQQNT 插件
- Linux/macOS 的安装器不在该 Release 中：Linux 用 `NapCat-Installer` 脚本；macOS 用 `NapCat-Mac-Installer` 的 Release。
- 自动下载只从官方 GitHub Release / 官方安装器地址下载；下载后由用户确认再执行。运行期不修改 NapCat 文件。
- 若后续要“静默自动安装”，只能在 Windows OneKey 上评估，且必须保留用户确认与失败回退。

## 4. QQ 登录与 OneBot 配置

1. 启动 NapCat（或安装后首次启动），打开 WebUI（NapCat 默认 WebUI 端口以实际配置为准，常见 6099）。
2. 用户在 WebUI 扫码登录 QQ。
3. 在 WebUI 配置 OneBot HTTP 服务：监听 `127.0.0.1`，端口默认 `3000`，设置 access token。
4. Chatnip 将 `baseUrl`/`accessToken` 写入 `userData/config/qq.json`（token 用 `safeStorage` 加密），代理请求时注入 `Authorization`。
5. Chatnip 健康检查：调用 OneBot `get_login_info`（或 `get_status`）；失败时提示“打开 WebUI / 检查 OneBot 配置”。

## 5. OneBot API 契约（Chatnip 所需 5 个 action）

| Action | 参数 | 备注 |
|---|---|---|
| `get_group_list` | 无 | 返回 `data` 数组 |
| `get_friend_list` | 无 | 返回 `data` 数组 |
| `get_group_member_list` | `group_id` | 返回 `data` 数组 |
| `get_group_msg_history` | `group_id`, `message_seq?`, `count`, `reverse_order` | `message_seq` 为短消息 ID |
| `get_friend_msg_history` | `user_id`, `message_seq?`, `count`, `reverse_order` | 同上 |

### `message_seq` 语义（关键结论）

NapCat 的 OB11 `message_id` 是 `MessageUnique.createUniqueMsgId()` 生成的 **shortId**（MD5 前 4 字节，符号位清零的 int32）。`GetGroupMsgHistory.ts` / `GetFriendMsgHistory.ts` 中：

```ts
const startMsgId = hasMessageSeq
  ? (MessageUnique.getMsgIdAndPeerByShortId(+payload.message_seq!)?.MsgId
     ?? payload.message_seq!.toString())
  : '0'
```

因此 **把上一批最旧消息的 `message_id` 作为 `message_seq` 传入是 NapCat 的预期兼容用法**，不是参数错误。

注意事项：
- `LimitedHashTable` 默认最多 5000 条短 ID 映射；翻页很深时旧 ID 可能被淘汰，fallback 会把 shortId 字符串直接当 MsgId 使用，可能失败。需要在真实 NapCat 上做“大范围/多批”联调。
- `count` 未在源码中看到硬上限；仍建议单批 ≤1000，并用“空批次 / 时间已覆盖 / 锚点未前进 / maxBatches”四重停止条件。
- `reverse_order` 默认 false；Chatnip 目前依赖“最新在前”的批次顺序，联调时确认返回顺序。

## 6. 许可证与再分发

NapCat 使用 **Limited Redistribution License**（非 OSI 开源许可）：

- 未经作者明确许可，禁止使用、复制、修改、分发；
- 允许再分发，但必须附带完整许可证全文、注明来源与版权；
- 允许为再分发做小幅修改，但修改后的代码不得公开；
- **禁止商业用途**；
- 其他权利需向作者申请。

对 Chatnip 的约束：
- **绝不把 NapCat 打入 Chatnip 安装包**（会构成再分发；且与 GPLv3 不兼容）。
- 自动下载只从官方地址获取，且不修改其代码；下载器本身不包含 NapCat 代码。
- 在 About/README/首次启动向导中附许可证全文、来源链接与非商业提示。
- 若 Chatnip 本身要商业分发，必须先取得 NapCat 作者授权。

## 7. 风险与待办

| 风险 | 影响 | 缓解 |
|---|---|---|
| QQ 账号风控/封禁 | 用户损失 | 首次启动显著提示；不自动登录；不存储密码；提供退出/卸载指引 |
| 安装器需要 GUI/管理员权限 | 自动安装不可行 | 引导安装；用户确认后启动官方安装器 |
| Linux 需要 QQ + Xvfb/Docker | 安装门槛高 | 检测 Docker；优先引导 Docker Compose；文档给出手动步骤 |
| macOS 安装器修改 QQ 入口 | 需要用户授权，可能被 Gatekeeper 拦截 | 引导用户手动运行；不代改 QQ |
| 短 ID 缓存淘汰 | 深翻页失败 | 真实 NapCat 联调；锚点失败时回退“从最新重新拉取”并告警 |
| NapCat 版本/配置变化 | 集成失效 | 固定最低版本；健康检查 + 版本提示；不自动升级 |
| 许可证限制 | 商业分发不可行 | 非商业声明；需要商业化时联系作者 |

## 8. 待实测项（M1/M3）

- WebUI 实际端口与登录页 URL 的获取方式。
- `count` 实际上限与返回顺序（`reverse_order`）。
- 深翻页（>5000 条）时锚点是否仍可解析。
- Windows OneKey 安装器的静默/半自动参数（若有）。
- Linux `napcat.sh` 的非交互参数与 Docker 检测。
- macOS NapCat-Mac-Installer 的安装结果检测路径。
