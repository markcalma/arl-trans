import { pollNewDOs, pollWaterReportEmails } from './gmail'
import { parseAllDOsFromPdf } from './claude'
import { insertDOOrder, gmailIdExists, insertWF1Batch, wf1GmailIdExists } from './db'
import { parseWaterReportExcel, parseWaterReportText } from './wf1-parser'
import { parseUSFDeliveryOrderExcel } from './excel-do-parser'
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

      // Skip PAC (packing list) PDFs — they are not delivery orders
      const pdfAttachment = msg.attachments.find(
        (a) => a.mimeType === 'application/pdf' && !/ pac[. ]/i.test(a.filename)
      )
      const xlsxAttachment = msg.attachments.find(
        (a) => a.filename.endsWith('.xlsx') || a.filename.endsWith('.xls')
      )

      // Prefer xlsx when present (e.g. USF emails that include both xlsx DO + PAC pdf)
      if (xlsxAttachment && !pdfAttachment) {
        const parsed = parseUSFDeliveryOrderExcel(xlsxAttachment.data)
        const id = randomUUID()
        console.log(`[poller] Parsed Excel DO from ${msg.sender} (container: ${parsed.containerNumber || 'unknown'})`)
        insertDOOrder({
          id,
          status: 'pending_redaction',
          receivedAt: msg.receivedAt,
          sender: msg.sender,
          subject: msg.subject,
          gmailId: msg.gmailId,
          pdfPath: undefined,
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
        console.log(`[poller] Ingested Excel DO ${id} (container: ${parsed.containerNumber || 'unknown'})`)
      } else if (pdfAttachment) {
        // Save one shared PDF file, then create one DO record per container found
        const sharedId = randomUUID()
        const sharedPdfPath = path.join(PDF_DIR, `${sharedId}.pdf`)
        fs.writeFileSync(sharedPdfPath, pdfAttachment.data)
        fs.writeFileSync(path.join(PDF_DIR, `${sharedId}.original.pdf`), pdfAttachment.data)

        const parsedList = await parseAllDOsFromPdf(pdfAttachment.data)
        if (parsedList.length === 0) {
          console.log(`[poller] Claude returned no containers from PDF in "${msg.subject}" — skipping`)
          continue
        }

        for (let i = 0; i < parsedList.length; i++) {
          const parsed = parsedList[i]
          // For multi-container PDFs, each DO gets its own record id but shares the same PDF file.
          // Only the first record carries the gmailId — enough to prevent re-processing.
          const id = i === 0 ? sharedId : randomUUID()
          insertDOOrder({
            id,
            status: parsed.confidence === 'low' ? 'needs_manual_review' : 'pending_redaction',
            receivedAt: msg.receivedAt,
            sender: msg.sender,
            subject: msg.subject,
            gmailId: i === 0 ? msg.gmailId : undefined,
            pdfPath: sharedPdfPath,
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

        if (parsedList.length > 1) {
          console.log(`[poller] Created ${parsedList.length} DO records from merged PDF in "${msg.subject}"`)
        }
      }
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

      const excelAttachments = msg.attachments.filter(
        (a) => a.filename.endsWith('.xlsx') || a.filename.endsWith('.xlsm') || a.filename.endsWith('.xls')
      )

      if (excelAttachments.length > 0) {
        for (let i = 0; i < excelAttachments.length; i++) {
          const att = excelAttachments[i]
          const containers = parseWaterReportExcel(att.data)
          if (containers.length === 0) {
            console.log(`[poller/wf1] No containers in ${att.filename} — skipping`)
            continue
          }
          insertWF1Batch({
            id: randomUUID(),
            status: 'pending_review',
            receivedAt: msg.receivedAt,
            sender: msg.sender,
            subject: `${msg.subject} — ${att.filename}`,
            // Only first batch carries gmailId to prevent re-processing on next poll
            gmailId: i === 0 ? msg.gmailId : undefined,
            sourceFormat: 'excel',
            containers,
          })
          console.log(`[poller/wf1] Stored batch — ${containers.length} containers from "${att.filename}"`)
        }
      } else if (msg.body) {
        const containers = parseWaterReportText(msg.body)
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
          sourceFormat: 'text',
          containers,
        })
        console.log(`[poller/wf1] Stored batch — ${containers.length} containers from body`)
      }
    }
  } catch (err) {
    console.error('[poller/wf1] Error during WF1 poll:', err)
  }
}
