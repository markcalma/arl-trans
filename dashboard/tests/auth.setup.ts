import { test as setup } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const authFile = path.join(__dirname, '../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await page.goto('/login')
  await page.fill('input[type="password"]', process.env.DASHBOARD_PASSWORD ?? 'dev-password')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
  await page.context().storageState({ path: authFile })
})
