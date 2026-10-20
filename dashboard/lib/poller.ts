import { pollNewDOs } from './gmail'
import { parseDOFromPdf } from './claude'
import { insertDOOrder, gmailIdExists } from './db'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs')
const POLL_INTERVAL_MS = 60_000

let pollerStarted = false

export function startPoller(): void {
  if (pollerStarted) return
  pollerStarted = true

  console.log('[poller] Started — checking Gmail every 60s')
  runPoll()
  setInterval(runPoll, POLL_INTERVAL_MS)
}

async function runPoll(): Promise<void> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.ANTHROPIC_API_KEY) {
    return
  }

  const tokensPath = path.join(process.cwd(), 'google-tokens.json')
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
    console.error('[poller] Error during poll:', err)
  }
}
