import { NextRequest, NextResponse } from 'next/server'
import { getDOOrder } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const orderId = decodeURIComponent(id)
  const order = getDOOrder(orderId)

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!order.pdfPath) return NextResponse.json({ error: 'No PDF on this order' }, { status: 404 })

  const { box } = await req.json()

  const redactUrl = process.env.REDACT_SERVICE_URL ?? 'http://localhost:8000'
  const res = await fetch(`${redactUrl}/stamp-logo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfPath: order.pdfPath, box }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: res.status })
  }

  return NextResponse.json({ ok: true })
}
