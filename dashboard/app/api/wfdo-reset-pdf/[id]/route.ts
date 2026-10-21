import { NextRequest, NextResponse } from 'next/server'
import { getDOOrder } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const orderId = decodeURIComponent(id)
  const order = getDOOrder(orderId)

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!order.pdfPath) return NextResponse.json({ error: 'No PDF on this order' }, { status: 404 })

  const originalPath = order.pdfPath.replace(/\.pdf$/, '.original.pdf')
  if (!fs.existsSync(originalPath)) {
    return NextResponse.json({ error: 'No original saved for this order' }, { status: 404 })
  }

  fs.copyFileSync(originalPath, order.pdfPath)
  return NextResponse.json({ ok: true })
}
