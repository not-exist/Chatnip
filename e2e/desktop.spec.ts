import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: Awaited<ReturnType<typeof electron.launch>>
let userData: string

// The app is already built by the test command. Skip external service startup so
// this E2E only verifies the desktop shell, first-run flow, and local renderer.
test.beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'chatnip-e2e-'))
  app = await electron.launch({
    args: ['--no-sandbox', '.'],
    env: {
      ...process.env,
      CHATNIP_SKIP_SERVICES: '1',
      CHATNIP_USER_DATA: userData,
      ELECTRON_IS_DEV: '0',
    },
  })
})

test.afterEach(async () => {
  if (app) await app.close()
  await rm(userData, { recursive: true, force: true })
})

test('first-run wizard reaches Chatnip and settings exposes service status', async () => {
  const window = await app.firstWindow()
  await expect(window.getByRole('heading', { name: '首次启动' })).toBeVisible()
  await expect(window.getByText('Opencode（AI 分析）')).toBeVisible()
  await expect(window.getByText('NapCat（QQ 接入）')).toBeVisible()

  await window.getByRole('button', { name: '进入 Chatnip' }).click()
  await expect(window.getByRole('heading', { name: '会话选择' })).toBeVisible()

  await window.getByRole('link', { name: '设置' }).click()
  await expect(window.getByRole('heading', { name: '服务状态' })).toBeVisible()
  await expect(window.getByText('Opencode', { exact: true })).toBeVisible()
  await expect(window.getByText('NapCat', { exact: true })).toBeVisible()
})
