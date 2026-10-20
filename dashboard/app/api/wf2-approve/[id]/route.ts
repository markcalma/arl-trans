import { NextRequest, NextResponse } from 'next/server'
import { getTodayOrders, updateOrder } from '@/lib/storage'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const containerNumber = decodeURIComponent(id)

  const day = getTodayOrders()
  const order = day.orders.find((o) => o.containerNumber === containerNumber)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const customRate = typeof body.rate === 'number' && !isNaN(body.rate) ? body.rate : null

  const updates: Parameters<typeof updateOrder>[1] = { status: 'processed' }
  if (customRate !== null) {
    updates.rate = customRate
    if (order.carrierRate) {
      updates.carrierRate = { ...order.carrierRate, custTotal: customRate }
    }
  }

  updateOrder(containerNumber, updates)

  // Build the order as n8n will receive it (with updated rate)
  const updatedOrder = { ...order, ...updates }

  const webhookUrl = process.env.N8N_WF2_APPROVE_WEBHOOK_URL
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.WEBHOOK_SECRET,
        order: updatedOrder,
      }),
    }).catch((err) => console.error('Failed to notify n8n:', err))
  }

  return NextResponse.json({ ok: true })
}
