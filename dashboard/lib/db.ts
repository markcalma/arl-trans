import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { WFDOOrder, WF1Batch, WF1Container } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'arl.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  migrate(_db)
  return _db
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS water_report_batches (
      id                 TEXT PRIMARY KEY,
      status             TEXT NOT NULL DEFAULT 'pending_review',
      received_at        TEXT NOT NULL,
      sender             TEXT NOT NULL,
      subject            TEXT,
      gmail_id           TEXT UNIQUE,
      source_format      TEXT NOT NULL DEFAULT 'excel',
      containers         TEXT NOT NULL DEFAULT '[]',
      container_count    INTEGER NOT NULL DEFAULT 0,
      reviewed_at        TEXT,
      sheets_written_at  TEXT
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS delivery_orders (
      id                   TEXT PRIMARY KEY,
      status               TEXT NOT NULL DEFAULT 'pending_redaction',
      received_at          TEXT NOT NULL,
      sender               TEXT NOT NULL,
      subject              TEXT,
      gmail_id             TEXT UNIQUE,
      pdf_path             TEXT,
      container_number     TEXT,
      master_bl            TEXT,
      arrival_date         TEXT,
      consignee            TEXT,
      consignee_address    TEXT,
      cargo_description    TEXT,
      packages             TEXT,
      weight_kg            TEXT,
      weight_lb            TEXT,
      port_location        TEXT,
      seal_number          TEXT,
      nvo_name             TEXT,
      carrier_email        TEXT,
      carrier_notes        TEXT,
      packing_list_attached INTEGER NOT NULL DEFAULT 0,
      processed_at         TEXT NOT NULL,
      sent_at              TEXT
    );
  `)
}

function rowToOrder(row: Record<string, unknown>): WFDOOrder {
  return {
    id: row.id as string,
    status: row.status as WFDOOrder['status'],
    receivedAt: row.received_at as string,
    sender: row.sender as string,
    subject: (row.subject as string) ?? '',
    gmailId: (row.gmail_id as string) ?? undefined,
    pdfPath: (row.pdf_path as string) ?? undefined,
    containerNumber: (row.container_number as string) ?? '',
    masterBL: (row.master_bl as string) ?? '',
    arrivalDate: (row.arrival_date as string) ?? '',
    consignee: (row.consignee as string) ?? '',
    consigneeAddress: (row.consignee_address as string) ?? '',
    cargoDescription: (row.cargo_description as string) ?? '',
    packages: (row.packages as string) ?? '',
    weightKg: (row.weight_kg as string) ?? '',
    weightLb: (row.weight_lb as string) ?? '',
    portLocation: (row.port_location as string) ?? '',
    sealNumber: (row.seal_number as string) ?? '',
    nvoName: (row.nvo_name as string) ?? '',
    carrierEmail: (row.carrier_email as string) ?? '',
    carrierNotes: (row.carrier_notes as string) ?? '',
    packingListAttached: Boolean(row.packing_list_attached),
    processedAt: row.processed_at as string,
    sentAt: (row.sent_at as string) ?? undefined,
  }
}

export function insertDOOrder(order: WFDOOrder): void {
  const db = getDb()
  db.prepare(`
    INSERT OR IGNORE INTO delivery_orders (
      id, status, received_at, sender, subject, gmail_id, pdf_path,
      container_number, master_bl, arrival_date, consignee, consignee_address,
      cargo_description, packages, weight_kg, weight_lb, port_location,
      seal_number, nvo_name, carrier_email, carrier_notes,
      packing_list_attached, processed_at, sent_at
    ) VALUES (
      @id, @status, @receivedAt, @sender, @subject, @gmailId, @pdfPath,
      @containerNumber, @masterBL, @arrivalDate, @consignee, @consigneeAddress,
      @cargoDescription, @packages, @weightKg, @weightLb, @portLocation,
      @sealNumber, @nvoName, @carrierEmail, @carrierNotes,
      @packingListAttached, @processedAt, @sentAt
    )
  `).run({
    ...order,
    packingListAttached: order.packingListAttached ? 1 : 0,
    gmailId: order.gmailId ?? null,
    pdfPath: order.pdfPath ?? null,
    sentAt: order.sentAt ?? null,
  })
}

export function updateDOOrder(id: string, updates: Partial<WFDOOrder>): void {
  const db = getDb()
  const current = getDOOrder(id)
  if (!current) return
  const merged = { ...current, ...updates }
  db.prepare(`
    UPDATE delivery_orders SET
      status = @status,
      carrier_email = @carrierEmail,
      carrier_notes = @carrierNotes,
      container_number = @containerNumber,
      master_bl = @masterBL,
      arrival_date = @arrivalDate,
      consignee = @consignee,
      consignee_address = @consigneeAddress,
      cargo_description = @cargoDescription,
      packages = @packages,
      weight_kg = @weightKg,
      weight_lb = @weightLb,
      port_location = @portLocation,
      sent_at = @sentAt
    WHERE id = @id
  `).run({
    id,
    status: merged.status,
    carrierEmail: merged.carrierEmail,
    carrierNotes: merged.carrierNotes,
    containerNumber: merged.containerNumber,
    masterBL: merged.masterBL,
    arrivalDate: merged.arrivalDate,
    consignee: merged.consignee,
    consigneeAddress: merged.consigneeAddress,
    cargoDescription: merged.cargoDescription,
    packages: merged.packages,
    weightKg: merged.weightKg,
    weightLb: merged.weightLb,
    portLocation: merged.portLocation,
    sentAt: merged.sentAt ?? null,
  })
}

export function getDOOrder(id: string): WFDOOrder | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? rowToOrder(row) : undefined
}

export function getAllDOOrders(): WFDOOrder[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM delivery_orders ORDER BY received_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToOrder)
}

export function getPendingDOOrders(): WFDOOrder[] {
  const db = getDb()
  const rows = db.prepare(
    "SELECT * FROM delivery_orders WHERE status != 'sent' ORDER BY received_at DESC"
  ).all() as Record<string, unknown>[]
  return rows.map(rowToOrder)
}

export function gmailIdExists(gmailId: string): boolean {
  const db = getDb()
  const row = db.prepare('SELECT 1 FROM delivery_orders WHERE gmail_id = ?').get(gmailId)
  return Boolean(row)
}

// ---------------------------------------------------------------------------
// WF1 — Water Report Batches
// ---------------------------------------------------------------------------

function rowToBatch(row: Record<string, unknown>): WF1Batch {
  return {
    id: row.id as string,
    status: row.status as WF1Batch['status'],
    receivedAt: row.received_at as string,
    sender: row.sender as string,
    subject: (row.subject as string) ?? '',
    gmailId: (row.gmail_id as string) ?? undefined,
    sourceFormat: (row.source_format as WF1Batch['sourceFormat']) ?? 'excel',
    containers: JSON.parse((row.containers as string) ?? '[]') as WF1Container[],
    containerCount: row.container_count as number,
    reviewedAt: (row.reviewed_at as string) ?? undefined,
    sheetsWrittenAt: (row.sheets_written_at as string) ?? undefined,
  }
}

export function insertWF1Batch(batch: Omit<WF1Batch, 'containerCount'>): void {
  const db = getDb()
  db.prepare(`
    INSERT OR IGNORE INTO water_report_batches
      (id, status, received_at, sender, subject, gmail_id, source_format, containers, container_count)
    VALUES
      (@id, @status, @receivedAt, @sender, @subject, @gmailId, @sourceFormat, @containers, @containerCount)
  `).run({
    id: batch.id,
    status: batch.status,
    receivedAt: batch.receivedAt,
    sender: batch.sender,
    subject: batch.subject ?? null,
    gmailId: batch.gmailId ?? null,
    sourceFormat: batch.sourceFormat,
    containers: JSON.stringify(batch.containers),
    containerCount: batch.containers.length,
  })
}

export function updateWF1BatchStatus(
  id: string,
  status: WF1Batch['status'],
  extra?: { reviewedAt?: string; sheetsWrittenAt?: string }
): void {
  const db = getDb()
  db.prepare(`
    UPDATE water_report_batches
    SET status = @status, reviewed_at = @reviewedAt, sheets_written_at = @sheetsWrittenAt
    WHERE id = @id
  `).run({
    id,
    status,
    reviewedAt: extra?.reviewedAt ?? null,
    sheetsWrittenAt: extra?.sheetsWrittenAt ?? null,
  })
}

export function getWF1Batch(id: string): WF1Batch | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM water_report_batches WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? rowToBatch(row) : undefined
}

export function getPendingWF1Batches(): WF1Batch[] {
  const db = getDb()
  const rows = db.prepare(
    "SELECT * FROM water_report_batches WHERE status = 'pending_review' ORDER BY received_at DESC"
  ).all() as Record<string, unknown>[]
  return rows.map(rowToBatch)
}

export function getAllWF1Batches(): WF1Batch[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM water_report_batches ORDER BY received_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToBatch)
}

export function wf1GmailIdExists(gmailId: string): boolean {
  const db = getDb()
  const row = db.prepare('SELECT 1 FROM water_report_batches WHERE gmail_id = ?').get(gmailId)
  return Boolean(row)
}
