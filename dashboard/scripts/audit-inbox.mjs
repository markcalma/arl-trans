import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/google-tokens.json'), 'utf8'))

const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
auth.setCredentials(tokens)
const gmail = google.gmail({ version: 'v1', auth })

function decodeBody(data) {
  if (!data) return ''
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function extractText(payload, depth = 0) {
  if (depth > 5) return ''
  const mime = payload.mimeType || ''
  if (mime === 'text/plain' && payload.body?.data) return decodeBody(payload.body.data)
  if (mime === 'text/html' && payload.body?.data) {
    return decodeBody(payload.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      const t = extractText(p, depth + 1)
      if (t.trim()) return t
    }
  }
  return ''
}

function collectAttachments(parts, result = []) {
  if (!parts) return result
  for (const p of parts) {
    if (p.filename && p.filename.length > 0) {
      result.push({ name: p.filename, mimeType: p.mimeType, size: p.body?.size || 0, attachmentId: p.body?.attachmentId })
    }
    if (p.parts) collectAttachments(p.parts, result)
  }
  return result
}

const list = await gmail.users.messages.list({ userId: 'me', maxResults: 50, q: 'newer_than:7d' })
const messages = list.data.messages || []
console.log(`Checking ${messages.length} emails from last 7 days\n${'='.repeat(70)}\n`)

for (const msg of messages) {
  const full = await gmail.users.messages.get({ userId: 'me', id: msg.id })
  const headers = full.data.payload.headers
  const subject = headers.find(h => h.name === 'Subject')?.value ?? '(no subject)'
  const from = headers.find(h => h.name === 'From')?.value ?? ''
  const date = headers.find(h => h.name === 'Date')?.value?.slice(0, 16) ?? ''
  const labels = full.data.labelIds || []
  const unread = labels.includes('UNREAD')

  const attachments = collectAttachments(full.data.payload.parts)
  const body = extractText(full.data.payload).slice(0, 600).trim()

  // Classify roughly
  const lSubject = subject.toLowerCase()
  const hasDoKeyword = /\bd[\/.·-]?o\b|delivery order|freight release/.test(lSubject)
  const hasPdf = attachments.some(a => a.name.toLowerCase().endsWith('.pdf'))
  const hasXlsx = attachments.some(a => /\.(xlsx|xlsm|xls)$/i.test(a.name))
  const hasPac = attachments.some(a => /pac[. ]/i.test(a.name))
  const hasPackingList = attachments.some(a => /pkl|packing.?list/i.test(a.name))
  const hasContainerReport = attachments.some(a => /container report/i.test(a.name))
  const hasAcrReport = attachments.some(a => /ACR.*Truck.*Dispatch|AMERCARE/i.test(a.name))
  const isImageOnly = attachments.length > 0 && attachments.every(a => /\.(png|jpg|jpeg|gif|ics|docx)$/i.test(a.name))

  let prediction = '⬜ SKIP (no PDF/xlsx)'
  if (isImageOnly) prediction = '⬜ SKIP (images only)'
  else if (hasPac) prediction = '⬜ SKIP (PAC file)'
  else if (hasPackingList) prediction = '⬜ SKIP (packing list)'
  else if (hasAcrReport) prediction = '🔵 WF1 water report'
  else if (hasContainerReport) prediction = '🟡 CHECK (container report xlsx)'
  else if (hasXlsx && !hasPdf) prediction = '🟠 CHECK (xlsx only — USF or water report?)'
  else if (hasPdf && hasDoKeyword) prediction = '🟢 LIKELY DO'
  else if (hasPdf) prediction = '🟡 MAYBE DO (Claude classifies)'
  else if (hasXlsx && hasPdf) prediction = '🟠 CHECK (both pdf+xlsx)'

  console.log(`${unread ? '📬' : '✅'} ${prediction}`)
  console.log(`   Date:    ${date}`)
  console.log(`   From:    ${from.slice(0, 60)}`)
  console.log(`   Subject: ${subject.slice(0, 80)}`)
  if (attachments.length) {
    console.log(`   Files:   ${attachments.map(a => `${a.name} (${Math.round(a.size/1024)}KB)`).join(' | ')}`)
  }
  if (body && prediction.includes('CHECK')) {
    console.log(`   Body:    ${body.slice(0, 300).replace(/\n/g, ' ')}`)
  }
  console.log()
}
