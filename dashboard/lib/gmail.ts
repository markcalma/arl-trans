import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { classifyEmailAsDO, classifyEmailAsWaterReport, classifyEmailAsETAUpdate } from './claude'
import { isGmailSkipped, markGmailSkipped } from './db'

const TOKENS_PATH = path.join(process.cwd(), 'data', 'google-tokens.json')
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI ?? 'http://localhost:3002/api/auth/gmail/callback'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/spreadsheets',
]

export interface GmailMessage {
  gmailId: string
  sender: string
  subject: string
  body: string
  attachments: GmailAttachment[]
  receivedAt: string
}

export interface GmailAttachment {
  filename: string
  mimeType: string
  data: Buffer
}

function getAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)

  // On Railway (or any fresh environment), seed from GOOGLE_TOKENS_JSON env var if present
  if (!fs.existsSync(TOKENS_PATH) && process.env.GOOGLE_TOKENS_JSON) {
    fs.mkdirSync(path.dirname(TOKENS_PATH), { recursive: true })
    fs.writeFileSync(TOKENS_PATH, process.env.GOOGLE_TOKENS_JSON)
  }
  if (!fs.existsSync(TOKENS_PATH)) {
    throw new Error(`Google tokens not found at ${TOKENS_PATH}. Run: npm run auth`)
  }
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))
  oauth2.setCredentials(tokens)

  oauth2.on('tokens', (newTokens) => {
    const existing = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))
    fs.writeFileSync(TOKENS_PATH, JSON.stringify({ ...existing, ...newTokens }, null, 2))
  })

  return oauth2
}

export function getAuthUrl(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
  return oauth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' })
}

export async function exchangeCode(code: string): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
  const { tokens } = await oauth2.getToken(code)
  fs.mkdirSync(path.dirname(TOKENS_PATH), { recursive: true })
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))
  console.log('Tokens saved to', TOKENS_PATH)
}

// force=true removes the is:unread filter — used by admin "Force scan" to catch already-read emails
export async function pollNewDOs(force = false): Promise<GmailMessage[]> {
  const auth = getAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  const q = force
    ? 'has:attachment newer_than:90d -category:promotions -category:social'
    : 'is:unread has:attachment newer_than:90d -category:promotions -category:social'

  const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 })
  const messages = listRes.data.messages ?? []
  if (messages.length === 0) return []
  console.log(`[gmail] Poll found ${messages.length} emails with attachments${force ? ' (force scan)' : ''}`)

  const results: GmailMessage[] = []

  for (const msg of messages) {
    if (!msg.id) continue
    if (isGmailSkipped(msg.id, 'wfdo')) continue

    // Step 1: metadata fetch — headers + snippet only, skips full MIME/attachment download
    const meta = await gmail.users.messages.get({
      userId: 'me', id: msg.id, format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    })
    const metaHeaders = meta.data.payload?.headers ?? []
    const subject = metaHeaders.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? ''
    const from = metaHeaders.find((h) => h.name?.toLowerCase() === 'from')?.value ?? ''
    const dateHeader = metaHeaders.find((h) => h.name?.toLowerCase() === 'date')?.value ?? ''
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()
    const snippet = meta.data.snippet ?? ''

    // Step 2: classify on subject + snippet — full MIME not needed for yes/no
    const isDO = await classifyEmailAsDO(subject, snippet)
    if (!isDO) {
      markGmailSkipped(msg.id, 'wfdo')
      console.log(`[gmail] Skipped non-DO email: "${subject}" from ${from}`)
      continue
    }

    // Step 3: confirmed DO — fetch full email to download attachment data
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const payload = full.data.payload
    if (!payload) continue

    const bodyText = extractBodyText(payload)
    const attachments = await extractAttachments(gmail, msg.id, payload)
    const filenames = attachments.map((a) => a.filename).join(', ')
    console.log(`[gmail] DO confirmed: "${subject}" — attachments: ${filenames || '(none)'}`)

    const hasRelevantAttachment = attachments.some(
      (a) => a.mimeType === 'application/pdf' || a.filename.endsWith('.xlsx') || a.filename.endsWith('.xls')
    )
    if (!hasRelevantAttachment) {
      markGmailSkipped(msg.id, 'wfdo')
      console.log(`[gmail] DO has no PDF/xlsx attachment — skipping`)
      continue
    }

    results.push({ gmailId: msg.id, sender: from, subject, body: bodyText, attachments, receivedAt })

    await gmail.users.messages.modify({
      userId: 'me',
      id: msg.id,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  }

  return results
}

type MessagePart = {
  parts?: unknown[]
  body?: { attachmentId?: string | null; data?: string | null } | null
  mimeType?: string | null
  filename?: string | null
}

function extractBodyText(payload: MessagePart): string {
  const parts: string[] = []

  function walk(part: MessagePart): void {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      try {
        parts.push(Buffer.from(part.body.data, 'base64url').toString('utf8'))
      } catch { /* ignore decode errors */ }
    }
    if (part.parts) {
      for (const child of part.parts as MessagePart[]) walk(child)
    }
  }

  walk(payload)
  return parts.join('\n')
}

async function extractAttachments(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string,
  payload: MessagePart
): Promise<GmailAttachment[]> {
  const attachments: GmailAttachment[] = []

  async function walk(part: MessagePart): Promise<void> {
    const filename = part.filename ?? ''
    const mimeType = part.mimeType ?? ''

    if (filename && part.body) {
      const body = part.body as { attachmentId?: string; data?: string }
      let data: Buffer

      if (body.attachmentId) {
        const attRes = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: body.attachmentId,
        })
        data = Buffer.from(attRes.data.data ?? '', 'base64url')
      } else if (body.data) {
        data = Buffer.from(body.data, 'base64url')
      } else {
        return
      }

      attachments.push({ filename, mimeType, data })
    }

    if (part.parts) {
      for (const child of part.parts as MessagePart[]) {
        await walk(child)
      }
    }
  }

  await walk(payload)
  return attachments
}

export async function sendEmail(opts: {
  to: string
  subject: string
  body: string
  attachmentPath?: string
  attachmentName?: string
}): Promise<void> {
  const auth = getAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  let raw: string

  if (opts.attachmentPath && opts.attachmentName) {
    const pdfBytes = fs.readFileSync(opts.attachmentPath)
    const boundary = `boundary_${Date.now()}`
    const pdfBase64 = pdfBytes.toString('base64')
    const mime = [
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      opts.body,
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${opts.attachmentName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${opts.attachmentName}"`,
      '',
      pdfBase64,
      `--${boundary}--`,
    ].join('\r\n')
    raw = Buffer.from(mime).toString('base64url')
  } else {
    const mime = [
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      opts.body,
    ].join('\r\n')
    raw = Buffer.from(mime).toString('base64url')
  }

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
}

// ---------------------------------------------------------------------------
// Poll for water report emails (WF1 — Amercare ACR Truck Dispatch Reports)
// ---------------------------------------------------------------------------
export async function pollWaterReportEmails(force = false): Promise<GmailMessage[]> {
  const auth = getAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  const q = force
    ? 'newer_than:90d -category:promotions -category:social'
    : 'is:unread newer_than:90d -category:promotions -category:social'
  const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 })
  const messages = listRes.data.messages ?? []
  if (messages.length === 0) return []
  console.log(`[gmail/wf1] Poll found ${messages.length} emails${force ? ' (force scan)' : ''}`)

  const results: GmailMessage[] = []

  for (const msg of messages) {
    if (!msg.id) continue
    if (isGmailSkipped(msg.id, 'wf1')) continue

    // Step 1: metadata fetch — headers + snippet only
    const meta = await gmail.users.messages.get({
      userId: 'me', id: msg.id, format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    })
    const metaHeaders = meta.data.payload?.headers ?? []
    const subject = metaHeaders.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? ''
    const from = metaHeaders.find((h) => h.name?.toLowerCase() === 'from')?.value ?? ''
    const dateHeader = metaHeaders.find((h) => h.name?.toLowerCase() === 'date')?.value ?? ''
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()
    const snippet = meta.data.snippet ?? ''

    // Subject shortcut: known water report subject patterns skip the Claude call entirely
    const subjectMatch = /ACR.*Truck.*Dispatch/i.test(subject) || /AMERCARE/i.test(subject)
    const isWaterReport = subjectMatch || await classifyEmailAsWaterReport(subject, snippet)
    if (!isWaterReport) {
      markGmailSkipped(msg.id, 'wf1')
      console.log(`[gmail/wf1] Skipped non-water-report: "${subject}"`)
      continue
    }
    console.log(`[gmail/wf1] Water report detected: "${subject}"${subjectMatch ? ' (subject shortcut)' : ''}`)

    // Step 3: confirmed — fetch full email for attachment data
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const payload = full.data.payload
    if (!payload) continue

    const bodyText = extractBodyText(payload)
    const attachments = await extractAttachments(gmail, msg.id, payload)

    const hasExcel = attachments.some(
      (a) => a.filename.endsWith('.xlsx') || a.filename.endsWith('.xlsm') || a.filename.endsWith('.xls')
    )

    results.push({
      gmailId: msg.id,
      sender: from,
      subject,
      body: bodyText,
      attachments: hasExcel ? attachments : [],
      receivedAt,
    })

    // Only mark as read if email actually has Excel content.
    // False positives left unread so the WF-DO poller can still pick them up.
    if (hasExcel) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: msg.id,
        requestBody: { removeLabelIds: ['UNREAD'] },
      })
    } else {
      markGmailSkipped(msg.id, 'wf1')
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Poll for ETA update emails — arrival notices, appointment confirmations,
// last-free-day notifications. These are text-only emails (no DO attachments).
// ---------------------------------------------------------------------------
export async function pollETAUpdateEmails(force = false): Promise<GmailMessage[]> {
  const auth = getAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  const q = force
    ? 'newer_than:90d -category:promotions -category:social'
    : 'is:unread newer_than:90d -category:promotions -category:social'
  const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 })
  const messages = listRes.data.messages ?? []
  if (messages.length === 0) return []

  const results: GmailMessage[] = []

  for (const msg of messages) {
    if (!msg.id) continue
    if (isGmailSkipped(msg.id, 'eta')) continue

    // Step 1: metadata fetch — headers + snippet only
    const meta = await gmail.users.messages.get({
      userId: 'me', id: msg.id, format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    })
    const metaHeaders = meta.data.payload?.headers ?? []
    const subject = metaHeaders.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? ''
    const from = metaHeaders.find((h) => h.name?.toLowerCase() === 'from')?.value ?? ''
    const dateHeader = metaHeaders.find((h) => h.name?.toLowerCase() === 'date')?.value ?? ''
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()
    const snippet = meta.data.snippet ?? ''

    // Step 2: classify on subject + snippet — full body not needed for yes/no
    const isETA = await classifyEmailAsETAUpdate(subject, snippet)
    if (!isETA) {
      markGmailSkipped(msg.id, 'eta')
      continue
    }

    console.log(`[gmail/eta] ETA update detected: "${subject}" from ${from}`)

    // Step 3: confirmed — fetch full email to get body text for parsing
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const payload = full.data.payload
    if (!payload) continue

    const bodyText = extractBodyText(payload)
    results.push({ gmailId: msg.id, sender: from, subject, body: bodyText, attachments: [], receivedAt })

    await gmail.users.messages.modify({
      userId: 'me',
      id: msg.id,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Poll for Team Three daily schedule emails (Stockton / Exton updated schedules).
// These arrive as plain-text emails with NO attachment from weareacr.com.
// Subject pattern: "[Location] Updated Schedule M/D"
// ---------------------------------------------------------------------------
export async function pollTeamThreeEmails(force = false): Promise<GmailMessage[]> {
  const auth = getAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  const q = force
    ? 'newer_than:90d -category:promotions -category:social'
    : 'is:unread newer_than:90d -category:promotions -category:social'
  const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 })
  const messages = listRes.data.messages ?? []
  if (messages.length === 0) return []

  const results: GmailMessage[] = []

  for (const msg of messages) {
    if (!msg.id) continue
    if (isGmailSkipped(msg.id, 'team3')) continue

    const meta = await gmail.users.messages.get({
      userId: 'me', id: msg.id, format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    })
    const metaHeaders = meta.data.payload?.headers ?? []
    const subject = metaHeaders.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? ''
    const from = metaHeaders.find((h) => h.name?.toLowerCase() === 'from')?.value ?? ''
    const dateHeader = metaHeaders.find((h) => h.name?.toLowerCase() === 'date')?.value ?? ''
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

    // Detect: subject must mention Stockton/Exton + Updated Schedule
    const isSchedule = /updated schedule/i.test(subject) &&
      /(stockton|exton)/i.test(subject)
    if (!isSchedule) {
      markGmailSkipped(msg.id, 'team3')
      continue
    }

    console.log(`[gmail/team3] Schedule detected: "${subject}" from ${from}`)

    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const payload = full.data.payload
    if (!payload) continue

    const bodyText = extractBodyText(payload)

    results.push({ gmailId: msg.id, sender: from, subject, body: bodyText, attachments: [], receivedAt })

    await gmail.users.messages.modify({
      userId: 'me', id: msg.id,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  }

  return results
}
