import { NextRequest, NextResponse } from 'next/server'
import { saveEmailStatus } from '@/lib/storage'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sentAt = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  saveEmailStatus(sentAt)
  return NextResponse.json({ ok: true })
}
