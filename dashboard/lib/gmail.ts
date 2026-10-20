import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

const TOKENS_PATH = path.join(process.cwd(), 'google-tokens.json')
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
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

  if (!fs.existsSync(TOKENS_PATH)) {
    throw new Error(`Google tokens not found. Run: npx ts-node scripts/google-auth.ts`)
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
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))
  console.log('Tokens saved to', TOKENS_PATH)
}

export async function pollNewDOs(): Promise<GmailMessage[]> {
  const auth = getAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  const senderFilter = process.env.DO_SENDER_EMAILS ?? ''
  const senders = senderFilter.split(',').map((s) => s.trim()).filter(Boolean)

  // Build query: unread emails with PDF attachments, optionally filtered by sender
  let q = 'is:unread has:attachment'
  if (senders.length > 0) {
    const fromParts = senders.map((s) => `from:${s}`).join(' OR ')
    q += ` (${fromParts})`
  }

  const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 20 })
  const messages = listRes.data.messages ?? []
  if (messages.length === 0) return []

  const results: GmailMessage[] = []

  for (const msg of messages) {
    if (!msg.id) continue
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const payload = full.data.payload
    if (!payload) continue

    const headers = payload.headers ?? []
    const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? ''
    const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? ''
    const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value ?? ''
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

    const attachments = await extractAttachments(gmail, msg.id, payload)

    // Only process if there's at least one PDF or Excel attachment
    const hasRelevantAttachment = attachments.some(
      (a) => a.mimeType === 'application/pdf' || a.filename.endsWith('.xlsx') || a.filename.endsWith('.xls')
    )
    if (!hasRelevantAttachment) continue

    results.push({ gmailId: msg.id, sender: from, subject, body: '', attachments, receivedAt })

    // Mark as read so we don't pick it up again
    await gmail.users.messages.modify({
      userId: 'me',
      id: msg.id,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  }

  return results
}

async function extractAttachments(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string,
  payload: { parts?: unknown[]; body?: { attachmentId?: string; data?: string }; mimeType?: string; filename?: string }
): Promise<GmailAttachment[]> {
  const attachments: GmailAttachment[] = []

  async function walk(part: typeof payload): Promise<void> {
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
      for (const child of part.parts as typeof payload[]) {
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
