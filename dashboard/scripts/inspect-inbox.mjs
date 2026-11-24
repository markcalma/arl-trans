import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/google-tokens.json'), 'utf8'))

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
)
auth.setCredentials(tokens)

const gmail = google.gmail({ version: 'v1', auth })

// Fetch last 30 emails (all, not just unread)
const list = await gmail.users.messages.list({
  userId: 'me',
  maxResults: 30,
  q: 'has:attachment',
})

const messages = list.data.messages || []
console.log(`Found ${messages.length} emails with attachments\n`)

for (const msg of messages) {
  const full = await gmail.users.messages.get({ userId: 'me', id: msg.id })
  const headers = full.data.payload.headers
  const subject = headers.find(h => h.name === 'Subject')?.value ?? '(no subject)'
  const from = headers.find(h => h.name === 'From')?.value ?? '(no from)'
  const date = headers.find(h => h.name === 'Date')?.value ?? ''

  // Get attachment filenames
  const parts = full.data.payload.parts || []
  const attachments = []
  const walk = (ps) => {
    for (const p of ps) {
      if (p.filename && p.filename.length > 0) attachments.push(p.filename)
      if (p.parts) walk(p.parts)
    }
  }
  walk(parts)

  const labels = full.data.labelIds || []
  const read = !labels.includes('UNREAD')

  console.log(`${read ? '✅ READ' : '📬 UNREAD'} | ${date.slice(0, 16)}`)
  console.log(`  From:    ${from}`)
  console.log(`  Subject: ${subject}`)
  console.log(`  Files:   ${attachments.length ? attachments.join(', ') : '(none)'}`)
  console.log()
}
