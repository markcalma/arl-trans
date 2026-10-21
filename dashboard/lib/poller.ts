import { pollNewDOs, pollWaterReportEmails } from './gmail'
import { parseDOFromPdf } from './claude'
import { insertDOOrder, gmailIdExists, insertWF1Batch, wf1GmailIdExists } from './db'
import { parseWaterReportExcel, parseWaterReportText } from './wf1-parser'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs')
const POLL_INTERVAL_MS = 60_000

let pollerStarted = false

export function startPoller(): void {
  if (pollerStarted) return
  pollerStarted = true

  console.log('[poller] Started — checking Gmail every 60s (WF-DO + WF1)')
  runDoPoll()
  runWF1Poll()
  setInterval(runDoPoll, POLL_INTERVAL_MS)
  setInterval(runWF1Poll, POLL_INTERVAL_MS)
}

async function runDoPoll(): Promise<void> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.ANTHROPIC_API_KEY) {
    return
  }

  const tokensPath = path.join(process.cwd(), 'data', 'google-tokens.json')
  if (!fs.existsSync(tokensPath)) return

  try {
    const messages = await pollNewDOs()
    if (messages.length === 0) return
    console.log(`[poller] Found ${messages.length} new DO email(s)`)

    if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true })

    for (const msg of messages) {
      if (gmailIdExists(msg.gmailId)) continue

      const pdfAttachment = msg.attachments.find((a) => a.mimeType === 'application/pdf')
      const xlsxAttachment = msg.attachments.find(
        (a) => a.filename.endsWith('.xlsx') || a.filename.endsWith('.xls')
      )

      const id = randomUUID()
      let pdfPath: string | undefined
      let parsed

      if (pdfAttachment) {
        pdfPath = path.join(PDF_DIR, `${id}.pdf`)
        fs.writeFileSync(pdfPath, pdfAttachment.data)
        fs.writeFileSync(path.join(PDF_DIR, `${id}.original.pdf`), pdfAttachment.data)
        parsed = await parseDOFromPdf(pdfAttachment.data)
      } else if (xlsxAttachment) {
        // For Excel, we don't render a canvas preview — pass the text to Claude
        // (Excel parsing can be added later; for now log and skip)
        console.log(`[poller] Excel DO received from ${msg.sender} — Excel parsing not yet implemented`)
        continue
      } else {
        continue
      }

      insertDOOrder({
        id,
        status: parsed.confidence === 'low' ? 'needs_manual_review' : 'pending_redaction',
        receivedAt: msg.receivedAt,
        sender: msg.sender,
        subject: msg.subject,
        gmailId: msg.gmailId,
        pdfPath,
        containerNumber: parsed.containerNumber,
        masterBL: parsed.masterBL,
        arrivalDate: parsed.arrivalDate,
        consignee: parsed.consignee,
        consigneeAddress: parsed.consigneeAddress,
        cargoDescription: parsed.cargoDescription,
        packages: parsed.packages,
        weightKg: parsed.weightKg,
        weightLb: parsed.weightLb,
        portLocation: parsed.portLocation,
        sealNumber: parsed.sealNumber,
        nvoName: parsed.nvoName,
        carrierEmail: parsed.carrierEmail,
        carrierNotes: '',
        packingListAttached: parsed.packingListAttached,
        processedAt: new Date().toISOString(),
      })

      console.log(`[poller] Ingested DO ${id} (container: ${parsed.containerNumber || 'unknown'})`)
    }
  } catch (err) {
    console.error('[poller] Error during WF-DO poll:', err)
  }
}

async function runWF1Poll(): Promise<void> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.ANTHROPIC_API_KEY) {
    return
  }

  const tokensPath = path.join(process.cwd(), 'data', 'google-tokens.json')
  if (!fs.existsSync(tokensPath)) return

  try {
    const messages = await pollWaterReportEmails()
    if (messages.length === 0) return
    console.log(`[poller/wf1] Found ${messages.length} water report email(s)`)

    for (const msg of messages) {
      if (wf1GmailIdExists(msg.gmailId)) continue

      const excelAttachment = msg.attachments.find(
        (a) => a.filename.endsWith('.xlsx') || a.filename.endsWith('.xlsm') || a.filename.endsWith('.xls')
      )

      let containers
      let sourceFormat: 'excel' | 'text'

      if (excelAttachment) {
        containers = parseWaterReportExcel(excelAttachment.data)
        sourceFormat = 'excel'
        console.log(`[poller/wf1] Parsed ${containers.length} containers from Excel (${excelAttachment.filename})`)
      } else if (msg.body) {
        containers = parseWaterReportText(msg.body)
        sourceFormat = 'text'
        console.log(`[poller/wf1] Parsed ${containers.length} containers from email body`)
      } else {
        continue
      }

      if (containers.length === 0) {
        console.log(`[poller/wf1] No containers parsed from "${msg.subject}" — skipping`)
        continue
      }

      insertWF1Batch({
        id: randomUUID(),
        status: 'pending_review',
        receivedAt: msg.receivedAt,
        sender: msg.sender,
        subject: msg.subject,
        gmailId: msg.gmailId,
        sourceFormat,
        containers,
      })

      console.log(`[poller/wf1] Stored batch — ${containers.length} containers from "${msg.subject}"`)
    }
  } catch (err) {
    console.error('[poller/wf1] Error during WF1 poll:', err)
  }
}
