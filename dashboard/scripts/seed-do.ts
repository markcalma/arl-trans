/**
 * Inserts test Delivery Orders into the local SQLite DB.
 * Run: npx tsx scripts/seed-do.ts
 * Safe to run multiple times (INSERT OR IGNORE).
 */

import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'arl.db')
const db = new Database(DB_PATH)

const now = new Date().toISOString()

const orders = [
  {
    id: 'test-do-pending-001',
    status: 'pending_redaction',
    received_at: now,
    sender: 'dispatch@nvo-carrier.com',
    subject: 'DO — BMOU1234567 — Consignee Corp',
    gmail_id: 'test-gmail-001',
    pdf_path: null,
    container_number: 'BMOU1234567',
    master_bl: 'MAEU123456789',
    arrival_date: '2026-11-05',
    consignee: 'Consignee Corp LLC',
    consignee_address: '123 Warehouse Blvd, Los Angeles CA 90001',
    cargo_description: 'Auto Parts',
    packages: '42 CTNS',
    weight_kg: '1850',
    weight_lb: '4078',
    port_location: 'Los Angeles / APM',
    seal_number: 'SL987654',
    nvo_name: 'NVO Holdings Inc',
    carrier_email: 'lorene@arl-trans.com',
    carrier_notes: '',
    packing_list_attached: 0,
    processed_at: now,
    sent_at: null,
  },
  {
    id: 'test-do-manual-002',
    status: 'needs_manual_review',
    received_at: new Date(Date.now() - 3600000).toISOString(),
    sender: 'ops@another-nvo.com',
    subject: 'Delivery Order — TCKU8888888',
    gmail_id: 'test-gmail-002',
    pdf_path: null,
    container_number: 'TCKU8888888',
    master_bl: '',
    arrival_date: '',
    consignee: 'Unknown Consignee',
    consignee_address: '',
    cargo_description: '',
    packages: '',
    weight_kg: '',
    weight_lb: '',
    port_location: '',
    seal_number: '',
    nvo_name: '',
    carrier_email: '',
    carrier_notes: '',
    packing_list_attached: 0,
    processed_at: new Date(Date.now() - 3600000).toISOString(),
    sent_at: null,
  },
  {
    id: 'test-do-sent-003',
    status: 'sent',
    received_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    sender: 'dispatch@nvo-carrier.com',
    subject: 'DO — APZU9999999 — Delta Import',
    gmail_id: 'test-gmail-003',
    pdf_path: null,
    container_number: 'APZU9999999',
    master_bl: 'HLCU999888777',
    arrival_date: '2026-10-28',
    consignee: 'Delta Import & Export',
    consignee_address: '456 Commerce St, Houston TX 77002',
    cargo_description: 'Consumer Electronics',
    packages: '210 CTNS',
    weight_kg: '3200',
    weight_lb: '7055',
    port_location: 'Houston / Barbours Cut',
    seal_number: 'SL112233',
    nvo_name: 'NVO Holdings Inc',
    carrier_email: 'carrier@freight.com',
    carrier_notes: '',
    packing_list_attached: 0,
    processed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    sent_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

const stmt = db.prepare(`
  INSERT OR IGNORE INTO delivery_orders (
    id, status, received_at, sender, subject, gmail_id, pdf_path,
    container_number, master_bl, arrival_date, consignee, consignee_address,
    cargo_description, packages, weight_kg, weight_lb, port_location,
    seal_number, nvo_name, carrier_email, carrier_notes,
    packing_list_attached, processed_at, sent_at
  ) VALUES (
    @id, @status, @received_at, @sender, @subject, @gmail_id, @pdf_path,
    @container_number, @master_bl, @arrival_date, @consignee, @consignee_address,
    @cargo_description, @packages, @weight_kg, @weight_lb, @port_location,
    @seal_number, @nvo_name, @carrier_email, @carrier_notes,
    @packing_list_attached, @processed_at, @sent_at
  )
`)

for (const o of orders) {
  const result = stmt.run(o)
  if (result.changes > 0) {
    console.log(`Inserted: ${o.container_number} (${o.status})`)
  } else {
    console.log(`Already exists: ${o.container_number} — skipped`)
  }
}

db.close()
console.log('Done.')
