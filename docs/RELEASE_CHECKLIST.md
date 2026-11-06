# 安装包验收清单

用于 Windows/macOS/Linux 干净机器（或 VM）上的发布前检查。

## 通用

- [ ] 安装包可下载、校验和/大小正常
- [ ] 安装后能从开始菜单/Applications/桌面启动
- [ ] 首次启动进入“首次启动”向导
- [ ] Opencode 自动下载成功；断网时显示可恢复错误
- [ ] NapCat 安装引导可打开官方页面
- [ ] NapCat WebUI 可扫码登录 QQ
- [ ] 设置页两个服务状态正确；“重启 Opencode”可用
- [ ] 拉取群/好友列表成功
- [ ] 日期范围分析成功，维度卡渲染
- [ ] 追问成功；空回复/失败有提示
- [ ] 退出后无残留 opencode/NapCat 子进程（应用自己启动的）
- [ ] 升级到下一版本后设置/会话保留

## Windows

- [ ] NSIS 安装/卸载正常
- [ ] SmartScreen 提示（未签名时）有文档说明
- [ ] `%LOCALAPPDATA%\chatnip` 数据目录可读写
- [ ] 中文/空格用户名路径下聊天文件写入正常

## macOS

- [ ] DMG 拖入 Applications 后启动
- [ ] Gatekeeper 提示（未签名/未公证时）有文档说明
- [ ] Apple Silicon 与 Intel（或 universal）均可启动
- [ ] `~/Library/Application Support/Chatnip` 数据目录可读写

## Linux

- [ ] AppImage 可执行；Ubuntu 24.04 的 AppArmor 沙箱提示有说明
- [ ] deb 安装/卸载正常
- [ ] `~/.config/Chatnip` 数据目录可读写
- [ ] X11/Wayland 下窗口正常

## 已知未验证项

- Windows/macOS 干净机器尚未实际执行（当前只有 Linux 本地验证 + CI 构建）。
- NapCat 真实 QQ 登录、深翻页（>5000 条）尚未联调。
