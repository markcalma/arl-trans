import { test, expect } from '@playwright/test'

test('dashboard loads with mock data', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('ARL-Trans · Operations Dashboard')).toBeVisible()
})

test('webhook rejects missing secret', async ({ request }) => {
  const res = await request.post('/api/wf1-webhook', {
    data: { runId: 'test', runAt: new Date().toISOString() }
  })
  expect(res.status()).toBe(401)
})

test('webhook rejects wrong secret', async ({ request }) => {
  const res = await request.post('/api/wf1-webhook', {
    data: { secret: 'wrong-secret', runId: 'test' }
  })
  expect(res.status()).toBe(401)
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('run status bar shows last run info', async ({ page }) => {
  await expect(page.getByText('ARL-Trans · Operations Dashboard')).toBeVisible()
  await expect(page.getByText(/Last run:/)).toBeVisible()
  await expect(page.getByText('378')).toBeVisible()
  await expect(page.getByText('Success', { exact: false })).toBeVisible()
})

test('per diem alerts panel renders with urgent containers', async ({ page }) => {
  await expect(page.getByText(/Per Diem Alerts/)).toBeVisible()
  await expect(page.getByText('FCIU9906716').first()).toBeVisible()
  await expect(page.getByText('1 day')).toBeVisible()
  await expect(page.getByText('MSNU9228239').first()).toBeVisible()
  await expect(page.getByText('5 days')).toBeVisible()
})

test.afterEach(async ({ request }) => {
  const payload = require('fs').readFileSync('./mock/wf1-payload.json', 'utf8')
  await request.post('/api/wf1-webhook', { data: JSON.parse(payload) })
})

test('exception queue shows reuse load with done button', async ({ page }) => {
  await expect(page.getByText(/Exceptions/)).toBeVisible()
  await expect(page.getByText('EGHU8360897').first()).toBeVisible()
  await expect(page.getByText('Reuse Load')).toBeVisible()
  await expect(page.getByRole('button', { name: '✓ Done' })).toBeVisible()
})

test('exception queue shows exam flag as informational with no button', async ({ page }) => {
  await expect(page.getByText('TIIU5705770').first()).toBeVisible()
  await expect(page.getByText('Exam Flag')).toBeVisible()
  await expect(page.getByText('Under customs hold — row skipped')).toBeVisible()
  const examRow = page.locator('tr', { hasText: 'TIIU5705770' }).first()
  await expect(examRow.getByRole('button')).not.toBeVisible()
})

test('done button removes reuse load from view', async ({ page }) => {
  const doneBtn = page.getByRole('button', { name: '✓ Done' }).first()
  await doneBtn.click()
  await page.waitForResponse((res) =>
    res.url().includes('/api/exceptions/') && res.status() === 200
  )
  const exceptionQueue = page.getByTestId('exception-queue')
  await expect(exceptionQueue.getByText('EGHU8360897')).not.toBeVisible()
})

test('container table renders with containers', async ({ page }) => {
  await expect(page.getByText(/Containers/)).toBeVisible()
  await expect(page.getByText('EMCU1578644')).toBeVisible()
})

test('container table filters by location', async ({ page }) => {
  const locationSelect = page.locator('select').first()
  await locationSelect.selectOption('Stockton')
  await expect(page.getByText('EGHU8360897').first()).toBeVisible()
  await expect(page.getByText('EMCU1578644')).not.toBeVisible()
})

test('container table show all button expands rows', async ({ page }) => {
  const locationSelect = page.locator('select').first()
  await locationSelect.selectOption('All')
  const showAll = page.getByRole('button', { name: /Show all 12/ })
  await expect(showAll).toBeVisible()
  await showAll.click()
  await expect(page.getByText('SEKU4408000')).toBeVisible()
})

test('run log is collapsed by default', async ({ page }) => {
  await expect(page.getByText('Email detected')).not.toBeVisible()
})

test('run log expands when clicked', async ({ page }) => {
  await page.getByText(/Run Log/).click()
  await expect(page.getByText('Email detected')).toBeVisible()
  await expect(page.getByText('File parsed — 378 rows')).toBeVisible()
})

test('run log collapses when clicked again', async ({ page }) => {
  await page.getByText(/Run Log/).click()
  await expect(page.getByText('Email detected')).toBeVisible()
  await page.getByText(/Run Log/).click()
  await expect(page.getByText('Email detected')).not.toBeVisible()
})

test('WF2 page loads with mock data', async ({ page }) => {
  await page.goto('/wf2')
  await expect(page.getByText('ARL-Trans · Order Intake')).toBeVisible()
})

test('WF2 webhook rejects missing secret', async ({ request }) => {
  const res = await request.post('/api/wf2-webhook', {
    data: { date: '2026-09-02', order: { containerNumber: 'TEST1234567' } }
  })
  expect(res.status()).toBe(401)
})

test('WF2 webhook rejects wrong secret', async ({ request }) => {
  const res = await request.post('/api/wf2-webhook', {
    data: { secret: 'wrong-secret', date: '2026-09-02', order: { containerNumber: 'TEST1234567' } }
  })
  expect(res.status()).toBe(401)
})

test('WF2 webhook accepts valid secret and appends order', async ({ request }) => {
  const payload = require('fs').readFileSync('./mock/wf2-payload.json', 'utf8')
  const res = await request.post('/api/wf2-webhook', { data: JSON.parse(payload) })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.ok).toBe(true)
})

test('nav bar is visible on WF1 page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'WF1 · Water Report' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'WF2 · Order Intake' })).toBeVisible()
})

test('nav bar WF1 link is active on WF1 page', async ({ page }) => {
  await page.goto('/')
  const wf1Link = page.getByRole('link', { name: 'WF1 · Water Report' })
  await expect(wf1Link).toHaveClass(/border-b/)
})

test.describe('WF2 — Order Intake', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wf2')
  })

  test.afterEach(async () => {
    const fs = require('fs')
    const seed = fs.readFileSync('./mock/wf2-seed.json', 'utf8')
    fs.writeFileSync('./data/wf2-today.json', seed)
    fs.writeFileSync('./data/wf2-handled.json', '[]')
  })

  test('WF2 summary bar shows labels', async ({ page }) => {
    await expect(page.getByText('Orders in')).toBeVisible()
    await expect(page.getByText('Rate cons sent')).toBeVisible()
    await expect(page.getByText('Exceptions pending')).toBeVisible()
  })

  test('WF2 exception queue shows exceptions with Handled button', async ({ page }) => {
    await expect(page.getByTestId('wf2-exception-queue')).toBeVisible()
    await expect(page.getByText('TXGU5776680').first()).toBeVisible()
    await expect(page.getByText('Non-standard lane — no rate found').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '✓ Handled' }).first()).toBeVisible()
  })

  test('WF2 handled button removes exception from queue', async ({ page }) => {
    const btn = page.getByRole('button', { name: '✓ Handled' }).first()
    await btn.click()
    await page.waitForResponse((res) =>
      res.url().includes('/api/wf2-exceptions/') && res.status() === 200
    )
    const queue = page.getByTestId('wf2-exception-queue')
    await expect(queue.getByText('TXGU5776680')).not.toBeVisible()
  })

  test('WF2 orders table shows all orders', async ({ page }) => {
    await expect(page.getByText(/Orders Today/)).toBeVisible()
    await expect(page.getByText('EMCU1578644')).toBeVisible()
    await expect(page.getByText('TXGU5776680').first()).toBeVisible()
  })

  test('WF2 processed order shows green Processed pill', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'EMCU1578644' })
    await expect(row.getByText('Processed')).toBeVisible()
  })

  test('WF2 exception order shows orange Exception pill', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'TXGU5776680' })
    await expect(row.getByText('Exception')).toBeVisible()
  })

  test('WF2 nav bar active link highlighted on WF2 page', async ({ page }) => {
    const wf2Link = page.getByRole('link', { name: 'WF2 · Order Intake' })
    await expect(wf2Link).toHaveClass(/border-b/)
  })
})

test('WF3 page loads with mock data', async ({ page }) => {
  await page.goto('/wf3')
  await expect(page.getByText('ARL-Trans · Invoice Review')).toBeVisible()
})

test('WF3 webhook rejects missing secret', async ({ request }) => {
  const res = await request.post('/api/wf3-webhook', {
    data: { date: '2026-09-02', invoice: { containerNumber: 'TEST1234567' } }
  })
  expect(res.status()).toBe(401)
})

test('WF3 webhook rejects wrong secret', async ({ request }) => {
  const res = await request.post('/api/wf3-webhook', {
    data: { secret: 'wrong-secret', date: '2026-09-02', invoice: { containerNumber: 'TEST1234567' } }
  })
  expect(res.status()).toBe(401)
})

test('WF3 webhook accepts valid secret and appends invoice', async ({ request }) => {
  const payload = require('fs').readFileSync('./mock/wf3-payload.json', 'utf8')
  const res = await request.post('/api/wf3-webhook', { data: JSON.parse(payload) })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.ok).toBe(true)
})

test('nav bar shows WF3 link', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'WF3 · Invoice Review' })).toBeVisible()
})

test.describe('WF3 — Invoice Review', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wf3')
  })

  test.afterEach(async () => {
    const fs = require('fs')
    const seed = fs.readFileSync('./mock/wf3-seed.json', 'utf8')
    fs.writeFileSync('./data/wf3-today.json', seed)
    fs.writeFileSync('./data/wf3-resolved.json', '[]')
  })

  test('WF3 summary bar shows labels', async ({ page }) => {
    const bar = page.getByTestId('wf3-summary-bar')
    await expect(bar.getByText('Invoices in')).toBeVisible()
    await expect(bar.getByText('Matched')).toBeVisible()
    await expect(bar.getByText('Discrepancies pending')).toBeVisible()
  })

  test('WF3 discrepancy queue shows discrepancies with Resolved button', async ({ page }) => {
    await expect(page.getByTestId('wf3-discrepancy-queue')).toBeVisible()
    await expect(page.getByText('GLDU5847293').first()).toBeVisible()
    await expect(page.getByText('Invoiced $900, expected $750').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '✓ Resolved' }).first()).toBeVisible()
  })

  test('WF3 resolved button removes discrepancy from queue', async ({ page }) => {
    const btn = page.getByRole('button', { name: '✓ Resolved' }).first()
    await btn.click()
    await page.waitForResponse((res) =>
      res.url().includes('/api/wf3-discrepancies/') && res.status() === 200
    )
    const queue = page.getByTestId('wf3-discrepancy-queue')
    await expect(queue.getByText('GLDU5847293')).not.toBeVisible()
  })

  test('WF3 invoices table shows all invoices', async ({ page }) => {
    await expect(page.getByText(/Invoices Today/)).toBeVisible()
    await expect(page.getByText('MSDU8534291')).toBeVisible()
    await expect(page.getByText('GLDU5847293').first()).toBeVisible()
  })

  test('WF3 matched invoice shows green Matched pill', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'MSDU8534291' })
    await expect(row.getByText('Matched')).toBeVisible()
  })

  test('WF3 discrepancy invoice shows orange Discrepancy pill', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'GLDU5847293' })
    await expect(row.getByText('Discrepancy')).toBeVisible()
  })

  test('WF3 nav bar active link highlighted on WF3 page', async ({ page }) => {
    const wf3Link = page.getByRole('link', { name: 'WF3 · Invoice Review' })
    await expect(wf3Link).toHaveClass(/border-b/)
  })
})

test.describe('WF-DO proxy routes', () => {
  test('wfdo-render-page returns 404 for unknown ID', async ({ request }) => {
    const res = await request.get('/api/wfdo-render-page/DOESNOTEXIST')
    expect(res.status()).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  test('wfdo-manual-redact returns 404 for unknown ID', async ({ request }) => {
    const res = await request.post('/api/wfdo-manual-redact/DOESNOTEXIST', {
      data: { boxes: [] },
    })
    expect(res.status()).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })
})

test.describe('WF-DO — Redact Editor', () => {
  test.beforeAll(async () => {
    const fs = require('fs')
    const seed = fs.readFileSync('./mock/wfdo-seed.json', 'utf8')
    fs.writeFileSync('./data/wfdo-today.json', seed)
  })

  test.afterAll(async () => {
    const fs = require('fs')
    fs.writeFileSync('./data/wfdo-today.json', JSON.stringify({ date: '', orders: [] }))
  })

  test('wf-do page shows draw instruction text', async ({ page }) => {
    await page.goto('/wf-do')
    await expect(page.getByText('Draw boxes over NVO info to redact')).toBeVisible()
  })

  test('render-page img element is present in DOM', async ({ page }) => {
    await page.goto('/wf-do')
    const img = page.locator('img[src*="wfdo-render-page"]')
    await expect(img).toHaveCount(1)
  })

  test('Apply Redactions button is disabled initially', async ({ page }) => {
    await page.goto('/wf-do')
    await expect(page.getByRole('button', { name: /Apply Redactions/ })).toBeDisabled()
  })

  test('Undo button is disabled initially', async ({ page }) => {
    await page.goto('/wf-do')
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  test('Clear All button is disabled initially', async ({ page }) => {
    await page.goto('/wf-do')
    await expect(page.getByRole('button', { name: 'Clear All' })).toBeDisabled()
  })
})
