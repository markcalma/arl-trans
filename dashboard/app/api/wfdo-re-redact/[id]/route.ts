import { NextRequest, NextResponse } from 'next/server'
import { getDOOrder, updateDOOrder } from '@/lib/db'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const orderId = decodeURIComponent(id)
  const order = getDOOrder(orderId)

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 409 })

  updateDOOrder(orderId, { status: 'pending_redaction' })

  return NextResponse.json({ ok: true })
}
