export type RunStatus = 'success' | 'warning' | 'error'
export type LogStatus = 'ok' | 'warning' | 'error'
export type ExceptionType = 'reuse_load' | 'exam_flag'

export interface RunSummary {
  total: number
  added: number
  updated: number
  skipped: number
}

export interface PerDiemAlert {
  containerNumber: string
  location: string
  ssl: string
  lfd: string
  daysRemaining: number
}

export interface Exception {
  containerNumber: string
  type: ExceptionType
  location: string
  reason: string
}

export interface Container {
  containerNumber: string
  location: string
  eta: string
  lfd: string
  po: string
  terminal?: string
}

export interface LFDEntry {
  containerNumber: string
  lfd: string
  savedAt: string
}

export interface LogEntry {
  time: string
  step: string
  status: LogStatus
}

export interface WF1Run {
  runId: string
  runAt: string
  status: RunStatus
  summary: RunSummary
  perDiemAlerts: PerDiemAlert[]
  exceptions: Exception[]
  containers: Container[]
  runLog: LogEntry[]
}

export type WF2OrderStatus = 'pending_review' | 'processed' | 'exception'

export interface WF2CarrierRate {
  carrier: string
  carrLH: number | string
  carrFSC: number | string
  carrTotal: number | string
  custLH: number | string
  custTotal: number | string
}

export interface WF2Order {
  containerNumber: string
  customer: string
  destination: string
  carrier: string
  rate: number
  status: WF2OrderStatus
  exceptionReason?: string
  processedAt: string
  poNumber?: string
  mblNumber?: string
  truckLoadNumber?: string
  carrierRate?: WF2CarrierRate
  customerEmail?: string
}

export interface WF2Day {
  date: string
  orders: WF2Order[]
}

export type WF3InvoiceStatus = 'matched' | 'discrepancy'

export interface WF3Invoice {
  containerNumber: string
  carrier: string
  invoicedAmount: number
  expectedRate: number
  status: WF3InvoiceStatus
  discrepancyReason?: string
  processedAt: string
  poNumber?: string
}

export interface WF3Day {
  date: string
  invoices: WF3Invoice[]
}

export type WFDOOrderStatus = 'pending_redaction' | 'redacted' | 'sent' | 'needs_manual_review'

export interface WFDOOrder {
  id: string
  status: WFDOOrderStatus
  receivedAt: string
  sender: string
  subject?: string
  gmailId?: string
  pdfPath?: string
  containerNumber: string
  masterBL: string
  arrivalDate: string
  consignee: string
  consigneeAddress: string
  cargoDescription: string
  packages: string
  weightKg: string
  weightLb: string
  portLocation: string
  sealNumber: string
  nvoName: string
  carrierEmail: string
  carrierNotes: string
  packingListAttached: boolean
  processedAt: string
  sentAt?: string
}

export interface WFDODay {
  date: string
  orders: WFDOOrder[]
}

// ---------------------------------------------------------------------------
// WF1 — Water Report
// ---------------------------------------------------------------------------

export interface WF1Container {
  containerNumber: string
  destination: string
  eta: string            // ISO date string
  freeDays: number | null
  sslLine: string
  terminal: string
  size: string
  bl: string
  po: string
  sealNumber: string
}

export type WF1BatchStatus = 'pending_review' | 'approved' | 'rejected'

export interface WF1Batch {
  id: string
  status: WF1BatchStatus
  receivedAt: string
  sender: string
  subject: string
  gmailId?: string
  sourceFormat: 'excel' | 'text'
  containers: WF1Container[]
  containerCount: number
  reviewedAt?: string
  sheetsWrittenAt?: string
}
