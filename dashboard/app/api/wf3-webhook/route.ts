import { NextRequest, NextResponse } from 'next/server'
import { appendInvoice } from '@/lib/storage'
import { WF3Invoice } from '@/lib/types'

export async function POST(req: NextRequest) {
  let body: { secret?: string; date?: string; invoice?: WF3Invoice }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (body.secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!body.date || !body.invoice?.containerNumber) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  appendInvoice(body.date, body.invoice as WF3Invoice)

  return NextResponse.json({ ok: true })
}
