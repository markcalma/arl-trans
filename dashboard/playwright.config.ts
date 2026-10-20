import { defineConfig } from '@playwright/test'
import fs from 'fs'

// Playwright doesn't auto-load .env.local; load it here so auth.setup.ts
// gets DASHBOARD_PASSWORD and tests get WEBHOOK_SECRET.
try {
  const lines = fs.readFileSync('.env.local', 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* .env.local not present */ }

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3002',
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: '**/auth.setup.ts',
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3002',
    reuseExistingServer: true,
  },
})
