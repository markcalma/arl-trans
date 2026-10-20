import { NextRequest, NextResponse } from 'next/server'
import { getDOOrder } from '@/lib/storage'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const orderId = decodeURIComponent(id)
  const order = getDOOrder(orderId)

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const note = typeof body.note === 'string' ? body.note : ''

  const webhookUrl = process.env.N8N_WFDO_REREDACT_WEBHOOK_URL
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.WEBHOOK_SECRET,
        orderId,
        note,
        order,
      }),
    }).catch((err) => console.error('n8n re-redact webhook failed:', err))
  }

  return NextResponse.json({ ok: true })
}
