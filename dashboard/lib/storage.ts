import fs from 'fs'
import path from 'path'
import { WF1Run, WF2Order, WF2Day, LFDEntry, WF3Invoice, WF3Day, WFDOOrder, WFDODay } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')

function readJson<T>(filename: string, fallback: T): T {
  const filePath = path.join(DATA_DIR, filename)
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(filename: string, data: unknown): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2))
}

export function getLatestRun(): WF1Run | null {
  return readJson<WF1Run | null>('wf1-latest.json', null)
}

export function saveLatestRun(run: WF1Run): void {
  writeJson('wf1-latest.json', run)
  writeJson('wf1-handled.json', [])
  writeJson('wf1-email-status.json', { sentAt: null })
}

export function getEmailStatus(): { sentAt: string | null } {
  return readJson<{ sentAt: string | null }>('wf1-email-status.json', { sentAt: null })
}

export function saveEmailStatus(sentAt: string): void {
  writeJson('wf1-email-status.json', { sentAt })
}

export function getHandled(): string[] {
  return readJson<string[]>('wf1-handled.json', [])
}

export function addHandled(containerNumber: string): void {
  const handled = getHandled()
  if (!handled.includes(containerNumber)) {
    writeJson('wf1-handled.json', [...handled, containerNumber])
  }
}

export function getTodayOrders(): WF2Day {
  return readJson<WF2Day>('wf2-today.json', { date: '', orders: [] })
}

export function appendOrder(date: string, order: WF2Order): void {
  const current = getTodayOrders()
  if (current.date !== date) {
    writeJson('wf2-today.json', { date, orders: [order] })
    writeJson('wf2-handled.json', [])
  } else {
    writeJson('wf2-today.json', { date, orders: [...current.orders, order] })
  }
}

export function getWF2Handled(): string[] {
  return readJson<string[]>('wf2-handled.json', [])
}

export function updateOrder(containerNumber: string, updates: Partial<WF2Order>): void {
  const day = getTodayOrders()
  const idx = day.orders.findIndex((o) => o.containerNumber === containerNumber)
  if (idx >= 0) {
    day.orders[idx] = { ...day.orders[idx], ...updates }
    writeJson('wf2-today.json', day)
  }
}

export function addWF2Handled(containerNumber: string): void {
  const handled = getWF2Handled()
  if (!handled.includes(containerNumber)) {
    writeJson('wf2-handled.json', [...handled, containerNumber])
  }
}

export function getLFDEntries(): LFDEntry[] {
  return readJson<LFDEntry[]>('wf1-lfd-manual.json', [])
}

export function saveLFDEntry(entry: LFDEntry): void {
  const entries = getLFDEntries()
  const idx = entries.findIndex((e) => e.containerNumber === entry.containerNumber)
  if (idx >= 0) {
    entries[idx] = entry
  } else {
    entries.push(entry)
  }
  writeJson('wf1-lfd-manual.json', entries)
}

export function clearLFDEntries(): void {
  writeJson('wf1-lfd-manual.json', [])
}

export function getTodayInvoices(): WF3Day {
  return readJson<WF3Day>('wf3-today.json', { date: '', invoices: [] })
}

export function appendInvoice(date: string, invoice: WF3Invoice): void {
  const current = getTodayInvoices()
  if (current.date !== date) {
    writeJson('wf3-today.json', { date, invoices: [invoice] })
    writeJson('wf3-resolved.json', [])
  } else {
    writeJson('wf3-today.json', { date, invoices: [...current.invoices, invoice] })
  }
}

export function getWF3Resolved(): string[] {
  return readJson<string[]>('wf3-resolved.json', [])
}

export function addWF3Resolved(containerNumber: string): void {
  const resolved = getWF3Resolved()
  if (!resolved.includes(containerNumber)) {
    writeJson('wf3-resolved.json', [...resolved, containerNumber])
  }
}

export function getTodayDOOrders(): WFDODay {
  return readJson<WFDODay>('wfdo-today.json', { date: '', orders: [] })
}

export function appendDOOrder(date: string, order: WFDOOrder): void {
  const current = getTodayDOOrders()
  const existing = current.orders.findIndex((o) => o.id === order.id)
  if (current.date !== date) {
    writeJson('wfdo-today.json', { date, orders: [order] })
  } else if (existing >= 0) {
    current.orders[existing] = order
    writeJson('wfdo-today.json', current)
  } else {
    writeJson('wfdo-today.json', { date, orders: [...current.orders, order] })
  }
}

export function updateDOOrder(id: string, updates: Partial<WFDOOrder>): void {
  const day = getTodayDOOrders()
  const idx = day.orders.findIndex((o) => o.id === id)
  if (idx >= 0) {
    day.orders[idx] = { ...day.orders[idx], ...updates }
    writeJson('wfdo-today.json', day)
  }
}

export function getDOOrder(id: string): WFDOOrder | undefined {
  return getTodayDOOrders().orders.find((o) => o.id === id)
}
