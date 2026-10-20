import { NextRequest, NextResponse } from 'next/server'
import { getTodayOrders, updateOrder } from '@/lib/storage'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const containerNumber = decodeURIComponent(id)

  const day = getTodayOrders()
  const order = day.orders.find((o) => o.containerNumber === containerNumber)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  updateOrder(containerNumber, {
    status: 'exception',
    exceptionReason: 'Rate rejected by reviewer',
  })

  return NextResponse.json({ ok: true })
}
