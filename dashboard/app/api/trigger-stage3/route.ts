import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_STAGE3_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Stage 3 webhook URL not configured' }, { status: 500 })
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: 'send-emails' }),
  })

  return NextResponse.json({ ok: true })
}
