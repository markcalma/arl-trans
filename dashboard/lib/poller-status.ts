import fs from 'fs'
import path from 'path'

const STATUS_PATH = path.join(process.cwd(), 'data', 'poller-status.json')

export interface PollStat {
  lastRun: string | null
  lastIngested: number
  lastError: string | null
}

export interface PollerStatus {
  wfdo: PollStat
  wf1: PollStat
  eta: PollStat
}

function read(): PollerStatus {
  try {
    if (fs.existsSync(STATUS_PATH)) return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'))
  } catch {}
  return {
    wfdo: { lastRun: null, lastIngested: 0, lastError: null },
    wf1:  { lastRun: null, lastIngested: 0, lastError: null },
    eta:  { lastRun: null, lastIngested: 0, lastError: null },
  }
}

function write(status: PollerStatus) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true })
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2))
}

export function updateWFDOStatus(ingested: number, error: string | null) {
  const s = read()
  s.wfdo = { lastRun: new Date().toISOString(), lastIngested: ingested, lastError: error }
  write(s)
}

export function updateWF1Status(ingested: number, error: string | null) {
  const s = read()
  s.wf1 = { lastRun: new Date().toISOString(), lastIngested: ingested, lastError: error }
  write(s)
}

export function updateETAStatus(processed: number, error: string | null) {
  const s = read()
  s.eta = { lastRun: new Date().toISOString(), lastIngested: processed, lastError: error }
  write(s)
}

export function readPollerStatus(): PollerStatus {
  return read()
}
