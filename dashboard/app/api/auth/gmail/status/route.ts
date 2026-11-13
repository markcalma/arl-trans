import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

const TOKENS_PATH = path.join(process.cwd(), 'data', 'google-tokens.json')

export async function GET() {
  if (!fs.existsSync(TOKENS_PATH)) {
    return NextResponse.json({ connected: false })
  }

  try {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    )
    oauth2.setCredentials(tokens)
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    const profile = await gmail.users.getProfile({ userId: 'me' })
    return NextResponse.json({
      connected: true,
      email: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
    })
  } catch (err) {
    return NextResponse.json({ connected: false, error: String(err) })
  }
}
