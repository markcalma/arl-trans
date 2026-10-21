import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { classifyEmailAsDO, classifyEmailAsWaterReport } from './claude'

const TOKENS_PATH = path.join(process.cwd(), 'data', 'google-tokens.json')

// In-memory sets of gmail IDs already classified this session (avoids repeated API calls)
const skippedGmailIds = new Set<string>()
const skippedWaterReportIds = new Set<string>()
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

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob')

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
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob')
  return oauth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' })
}

export async function exchangeCode(code: string): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob')
  const { tokens } = await oauth2.getToken(code)
  fs.mkdirSync(path.dirname(TOKENS_PATH), { recursive: true })
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))
  console.log('Tokens saved to', TOKENS_PATH)
}

export async function pollNewDOs(): Promise<GmailMessage[]> {
  const auth = getAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  // Search all unread emails with attachments — Claude will classify each one
  const q = 'is:unread has:attachment'

  const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 20 })
  const messages = listRes.data.messages ?? []
  if (messages.length === 0) return []

  const results: GmailMessage[] = []

  for (const msg of messages) {
    if (!msg.id) continue
    if (skippedGmailIds.has(msg.id)) continue

    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const payload = full.data.payload
    if (!payload) continue

    const headers = payload.headers ?? []
    const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? ''
    const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? ''
    const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value ?? ''
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

    const bodyText = extractBodyText(payload)

    // Use Claude to determine if this email is a delivery order
    const isDO = await classifyEmailAsDO(subject, bodyText)
    if (!isDO) {
      skippedGmailIds.add(msg.id)
      console.log(`[gmail] Skipped non-DO email: "${subject}" from ${from}`)
      continue
    }

    const attachments = await extractAttachments(gmail, msg.id, payload)

    const hasRelevantAttachment = attachments.some(
      (a) => a.mimeType === 'application/pdf' || a.filename.endsWith('.xlsx') || a.filename.endsWith('.xls')
    )
    if (!hasRelevantAttachment) {
      skippedGmailIds.add(msg.id)
      continue
    }

    results.push({ gmailId: msg.id, sender: from, subject, body: bodyText, attachments, receivedAt })

    // Mark as read so we don't pick it up again
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
  return parts.join('\n').slice(0, 1000)
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
// Returns emails that contain Excel or plain-text water report attachments.
// Does NOT mark them as read — the poller does that after successful storage.
// ---------------------------------------------------------------------------
function extractFilenamesFromPayload(payload: MessagePart): string[] {
  const names: string[] = []
  function walk(part: MessagePart) {
    if (part.filename) names.push(part.filename)
    if (part.parts) (part.parts as MessagePart[]).forEach(walk)
  }
  walk(payload)
  return names
}

export async function pollWaterReportEmails(): Promise<GmailMessage[]> {
  const auth = getAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  const listRes = await gmail.users.messages.list({ userId: 'me', q: 'is:unread', maxResults: 20 })
  const messages = listRes.data.messages ?? []
  if (messages.length === 0) return []

  const results: GmailMessage[] = []

  for (const msg of messages) {
    if (!msg.id) continue
    if (skippedWaterReportIds.has(msg.id)) continue

    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const payload = full.data.payload
    if (!payload) continue

    const headers = payload.headers ?? []
    const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? ''
    const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? ''
    const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value ?? ''
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

    const bodyText = extractBodyText(payload)
    const attachmentFilenames = extractFilenamesFromPayload(payload)

    // Shortcut: known water report filename patterns — skip Claude call
    const filenameMatch = attachmentFilenames.some((fn) =>
      /ACR.*Truck.*Dispatch/i.test(fn) || /AMERCARE/i.test(fn)
    )
    const isWaterReport = filenameMatch || await classifyEmailAsWaterReport(subject, bodyText)
    if (!isWaterReport) {
      skippedWaterReportIds.add(msg.id)
      console.log(`[gmail/wf1] Skipped non-water-report: "${subject}"`)
      continue
    }
    console.log(`[gmail/wf1] Water report detected: "${subject}" (filename match: ${filenameMatch})`)

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

    await gmail.users.messages.modify({
      userId: 'me',
      id: msg.id,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  }

  return results
}
