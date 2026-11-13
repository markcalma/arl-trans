import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/gmail'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

const TOKENS_PATH = path.join(process.cwd(), 'data', 'google-tokens.json')

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    if (!code?.trim()) return NextResponse.json({ error: 'No code provided' }, { status: 400 })

    await exchangeCode(code.trim())

    // Read the new tokens and get the connected email
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    )
    oauth2.setCredentials(tokens)
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const email = profile.data.emailAddress ?? 'unknown'

    return NextResponse.json({ ok: true, email })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
