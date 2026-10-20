import { NextRequest, NextResponse } from 'next/server'
import { getDOOrder, updateDOOrder } from '@/lib/storage'

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
  const updates = {
    status: 'sent' as const,
    sentAt: new Date().toISOString(),
    carrierEmail: body.carrierEmail ?? order.carrierEmail,
    carrierNotes: body.carrierNotes ?? order.carrierNotes,
    containerNumber: body.containerNumber ?? order.containerNumber,
    masterBL: body.masterBL ?? order.masterBL,
    arrivalDate: body.arrivalDate ?? order.arrivalDate,
    consignee: body.consignee ?? order.consignee,
    cargoDescription: body.cargoDescription ?? order.cargoDescription,
    packages: body.packages ?? order.packages,
    weightKg: body.weightKg ?? order.weightKg,
    portLocation: body.portLocation ?? order.portLocation,
  }

  updateDOOrder(orderId, updates)

  const webhookUrl = process.env.N8N_WFDO_APPROVE_WEBHOOK_URL
  if (webhookUrl) {
    const updatedOrder = { ...order, ...updates }
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.WEBHOOK_SECRET, order: updatedOrder }),
    }).catch((err) => console.error('n8n approve webhook failed:', err))
  }

  return NextResponse.json({ ok: true })
}
