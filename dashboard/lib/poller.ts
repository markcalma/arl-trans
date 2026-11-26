import { pollNewDOs, pollWaterReportEmails, pollETAUpdateEmails, pollTeamThreeEmails } from './gmail'
import { parseAllDOsFromPdf, parseETAUpdateEmail } from './claude'
import { insertDOOrder, gmailIdExists, insertWF1Batch, wf1GmailIdExists, etaUpdateGmailIdExists, insertETAUpdate } from './db'
import { parseWaterReportExcel, parseWaterReportText, parseTeamThreeSchedule } from './wf1-parser'
import { parseUSFDeliveryOrderExcel } from './excel-do-parser'
import { updateWFDOStatus, updateWF1Status, updateETAStatus } from './poller-status'
import { updateContainerETA } from './sheets'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs')
const POLL_INTERVAL_MS = 60_000

let pollerStarted = false

export function startPoller(): void {
  if (pollerStarted) return
  pollerStarted = true

  console.log('[poller] Started — checking Gmail every 60s (WF-DO + WF1 + ETA + Team3)')
  runDoPoll()
  runWF1Poll()
  runETAUpdatePoll()
  runTeamThreePoll()
  setInterval(runDoPoll, POLL_INTERVAL_MS)
  setInterval(runWF1Poll, POLL_INTERVAL_MS)
  setInterval(runETAUpdatePoll, POLL_INTERVAL_MS)
  setInterval(runTeamThreePoll, POLL_INTERVAL_MS)
}

export async function runDoPoll(force = false): Promise<{ ingested: number; error: string | null }> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.ANTHROPIC_API_KEY) {
    return { ingested: 0, error: null }
  }

  const tokensPath = path.join(process.cwd(), 'data', 'google-tokens.json')
  if (!fs.existsSync(tokensPath)) return { ingested: 0, error: null }

  let ingested = 0
  try {
    const messages = await pollNewDOs(force)
    if (messages.length === 0) {
      updateWFDOStatus(0, null)
      return { ingested: 0, error: null }
    }
    console.log(`[poller] Found ${messages.length} new DO email(s)`)

    if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true })

    for (const msg of messages) {
      if (gmailIdExists(msg.gmailId)) continue

      // Normalize container numbers: ISO 6346 format has no spaces (ABCD1234567)
      function normalizeContainer(s: string | undefined): string { return (s ?? '').replace(/\s+/g, '').toUpperCase() }

      // Skip PAC / PL (packing list) PDFs — they are not delivery orders
      const pdfAttachment = msg.attachments.find(
        (a) => a.mimeType === 'application/pdf' && !/ pac[. ]/i.test(a.filename) && !/ pl[. ]/i.test(a.filename)
      )
      const xlsxAttachment = msg.attachments.find(
        (a) => a.filename.endsWith('.xlsx') || a.filename.endsWith('.xls')
      )

      // Prefer xlsx when present (e.g. USF emails that include both xlsx DO + PAC pdf)
      if (xlsxAttachment && !pdfAttachment) {
        const parsed = parseUSFDeliveryOrderExcel(xlsxAttachment.data)
        const id = randomUUID()
        const excelContainer = normalizeContainer(parsed.containerNumber)
        console.log(`[poller] Parsed Excel DO from ${msg.sender} (container: ${excelContainer || 'unknown'})`)
        insertDOOrder({
          id,
          status: 'pending_redaction',
          receivedAt: msg.receivedAt,
          sender: msg.sender,
          subject: msg.subject,
          gmailId: msg.gmailId,
          pdfPath: undefined,
          containerNumber: excelContainer,
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
          customer: parsed.customer ?? '',
          carrierEmail: parsed.carrierEmail,
          carrierNotes: '',
          packingListAttached: parsed.packingListAttached,
          processedAt: new Date().toISOString(),
        })
        console.log(`[poller] Ingested Excel DO ${id} (container: ${parsed.containerNumber || 'unknown'})`)
        ingested++
      } else if (pdfAttachment) {
        const parsedList = await parseAllDOsFromPdf(pdfAttachment.data)
        if (parsedList.length === 0) {
          // Email already marked as read in pollNewDOs — save a stub so it surfaces in dashboard
          console.log(`[poller] Claude returned no containers from PDF in "${msg.subject}" — saving as needs_manual_review`)
          const id = randomUUID()
          const pdfPath = path.join(PDF_DIR, `${id}.pdf`)
          fs.writeFileSync(pdfPath, pdfAttachment.data)
          fs.writeFileSync(path.join(PDF_DIR, `${id}.original.pdf`), pdfAttachment.data)
          insertDOOrder({
            id,
            status: 'needs_manual_review',
            receivedAt: msg.receivedAt,
            sender: msg.sender,
            subject: msg.subject,
            gmailId: msg.gmailId,
            pdfPath,
            containerNumber: '',
            masterBL: '',
            arrivalDate: '',
            consignee: '',
            consigneeAddress: '',
            cargoDescription: '',
            packages: '',
            weightKg: '',
            weightLb: '',
            portLocation: '',
            sealNumber: '',
            nvoName: '',
            customer: '',
            carrierEmail: '',
            carrierNotes: '',
            packingListAttached: false,
            processedAt: new Date().toISOString(),
          })
          console.log(`[poller] Saved stub DO ${id} for manual review`)
          continue
        }

        for (let i = 0; i < parsedList.length; i++) {
          const parsed = parsedList[i]
          // Each DO gets its own PDF copy so redactions are independent.
          // Only the first record carries the gmailId — enough to prevent re-processing.
          const id = randomUUID()
          const pdfPath = path.join(PDF_DIR, `${id}.pdf`)
          fs.writeFileSync(pdfPath, pdfAttachment.data)
          fs.writeFileSync(path.join(PDF_DIR, `${id}.original.pdf`), pdfAttachment.data)
          insertDOOrder({
            id,
            status: parsed.confidence === 'low' ? 'needs_manual_review' : 'pending_redaction',
            receivedAt: msg.receivedAt,
            sender: msg.sender,
            subject: msg.subject,
            gmailId: i === 0 ? msg.gmailId : undefined,
            pdfPath,
            containerNumber: normalizeContainer(parsed.containerNumber),
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
            customer: parsed.customer ?? '',
            carrierEmail: parsed.carrierEmail,
            carrierNotes: '',
            packingListAttached: parsed.packingListAttached,
            processedAt: new Date().toISOString(),
          })
          console.log(`[poller] Ingested DO ${id} (container: ${parsed.containerNumber || 'unknown'})`)
          ingested++
        }

        if (parsedList.length > 1) {
          console.log(`[poller] Created ${parsedList.length} DO records from merged PDF in "${msg.subject}"`)
        }
      }
    }
    updateWFDOStatus(ingested, null)
    return { ingested, error: null }
  } catch (err) {
    const error = String(err)
    console.error('[poller] Error during WF-DO poll:', err)
    updateWFDOStatus(0, error)
    return { ingested: 0, error }
  }
}

export async function runWF1Poll(force = false): Promise<{ ingested: number; error: string | null }> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.ANTHROPIC_API_KEY) {
    return { ingested: 0, error: null }
  }

  const tokensPath = path.join(process.cwd(), 'data', 'google-tokens.json')
  if (!fs.existsSync(tokensPath)) return { ingested: 0, error: null }

  let ingested = 0
  try {
    const messages = await pollWaterReportEmails(force)
    if (messages.length === 0) {
      updateWF1Status(0, null)
      return { ingested: 0, error: null }
    }
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
          ingested++
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
        ingested++
      }
    }
    updateWF1Status(ingested, null)
    return { ingested, error: null }
  } catch (err) {
    const error = String(err)
    console.error('[poller/wf1] Error during WF1 poll:', err)
    updateWF1Status(0, error)
    return { ingested: 0, error }
  }
}

export async function runTeamThreePoll(force = false): Promise<{ ingested: number; error: string | null }> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return { ingested: 0, error: null }
  }
  const tokensPath = path.join(process.cwd(), 'data', 'google-tokens.json')
  if (!fs.existsSync(tokensPath)) return { ingested: 0, error: null }

  let ingested = 0
  try {
    const messages = await pollTeamThreeEmails(force)
    if (messages.length === 0) return { ingested: 0, error: null }
    console.log(`[poller/team3] Found ${messages.length} Team Three schedule email(s)`)

    for (const msg of messages) {
      if (wf1GmailIdExists(msg.gmailId)) continue

      const containers = parseTeamThreeSchedule(msg.body, msg.subject)
      if (containers.length === 0) {
        console.log(`[poller/team3] No containers parsed from "${msg.subject}" — skipping`)
        continue
      }

      insertWF1Batch({
        id: randomUUID(),
        status: 'pending_review',
        receivedAt: msg.receivedAt,
        sender: msg.sender,
        subject: msg.subject,
        gmailId: msg.gmailId,
        sourceFormat: 'team3',
        containers,
      })
      console.log(`[poller/team3] Stored ${containers.length} containers from "${msg.subject}"`)
      ingested++
    }
    return { ingested, error: null }
  } catch (err) {
    const error = String(err)
    console.error('[poller/team3] Error during Team Three poll:', err)
    return { ingested: 0, error }
  }
}

export async function runETAUpdatePoll(force = false): Promise<{ processed: number; error: string | null }> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.ANTHROPIC_API_KEY) {
    return { processed: 0, error: null }
  }
  const tokensPath = path.join(process.cwd(), 'data', 'google-tokens.json')
  if (!fs.existsSync(tokensPath)) return { processed: 0, error: null }

  let processed = 0
  try {
    const messages = await pollETAUpdateEmails(force)
    if (messages.length === 0) {
      updateETAStatus(0, null)
      return { processed: 0, error: null }
    }
    console.log(`[poller/eta] Found ${messages.length} ETA update email(s)`)

    for (const msg of messages) {
      if (etaUpdateGmailIdExists(msg.gmailId)) continue

      const updates = await parseETAUpdateEmail(msg.subject, msg.body)
      if (updates.length === 0) {
        console.log(`[poller/eta] No container updates parsed from "${msg.subject}" — skipping`)
        continue
      }

      insertETAUpdate({ id: randomUUID(), gmailId: msg.gmailId, subject: msg.subject, sender: msg.sender, updates })

      for (const update of updates) {
        if (!update.containerNumber) continue
        await updateContainerETA(update.containerNumber, {
          newETA: update.newETA,
          lastFreeDay: update.lastFreeDay,
          appointmentDate: update.appointmentDate,
        })
        console.log(`[poller/eta] Updated ETA for ${update.containerNumber} from "${msg.subject}"`)
      }
      processed++
    }
    updateETAStatus(processed, null)
    return { processed, error: null }
  } catch (err) {
    const error = String(err)
    console.error('[poller/eta] Error during ETA poll:', err)
    updateETAStatus(0, error)
    return { processed: 0, error }
  }
}
