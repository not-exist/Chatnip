# 代码签名与公证

当前默认构建是**未签名**的：

- `.github/workflows/desktop-build.yml` 设置 `CSC_IDENTITY_AUTO_DISCOVERY: 'false'`。
- `.github/workflows/release.yml` 目前同样不注入证书。
- 未签名产物可以安装/运行，但 Windows SmartScreen、macOS Gatekeeper 会提示风险，需要用户手动放行。

## Windows

准备代码签名证书（OV/EV 或 Azure Trusted Signing），在 GitHub 仓库 Secrets 中添加：

| Secret | 内容 |
|---|---|
| `WIN_CSC_LINK` | 证书的 base64（PFX/P12），或 Azure Trusted Signing 配置 |
| `WIN_CSC_KEY_PASSWORD` | 证书密码 |

然后在 release workflow 的对应 job 注入：

```yaml
env:
  CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
  CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

electron-builder 会自动对 NSIS 安装包与 exe 签名；`electron-updater` 会校验 Authenticode。

## macOS

需要 Apple Developer ID Application 证书与公证凭据：

| Secret | 内容 |
|---|---|
| `MAC_CSC_LINK` | Developer ID 证书的 base64（P12） |
| `MAC_CSC_KEY_PASSWORD` | 证书密码 |
| `APPLE_API_KEY` | App Store Connect API Key（.p8 文件内容） |
| `APPLE_API_KEY_ID` | Key ID |
| `APPLE_API_ISSUER` | Issuer ID |

在 macOS job 中：

```yaml
env:
  CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
  CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
  APPLE_API_KEY: ${{ runner.temp }}/AuthKey.p8
  APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
  APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
steps:
  - name: Write Apple API key
    if: matrix.os == 'macos-latest'
    run: printf '%s' "$APPLE_API_KEY_CONTENT" > "$RUNNER_TEMP/AuthKey.p8"
    env:
      APPLE_API_KEY_CONTENT: ${{ secrets.APPLE_API_KEY }}
```

同时把 `CSC_IDENTITY_AUTO_DISCOVERY` 设为 `'true'`（或删除该环境变量）。electron-builder 会签名 DMG/zip 中的 app，并调用 `notarytool` 公证。

## 自动更新

`electron-updater` 读取 electron-builder 生成的 `latest*.yml`。签名后自动更新会校验签名；未签名时仅适合内测。

## 参考

- electron-builder 代码签名：https://www.electron.build/code-signing
- macOS 公证：https://www.electron.build/notarization
- electron-updater：https://www.electron.build/auto-update
