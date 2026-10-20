import { NextRequest, NextResponse } from 'next/server'
import { appendOrder } from '@/lib/storage'
import { WF2Order } from '@/lib/types'

export async function POST(req: NextRequest) {
  let body: { secret?: string; date?: string; order?: WF2Order }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (body.secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!body.date || !body.order?.containerNumber) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  appendOrder(body.date, body.order as WF2Order)

  return NextResponse.json({ ok: true })
}
