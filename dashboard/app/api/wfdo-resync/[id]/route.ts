import { NextRequest, NextResponse } from 'next/server'
import { getDOOrder } from '@/lib/db'
import { appendToLoadBoard, appendToMasterList } from '@/lib/sheets'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orderId = decodeURIComponent(id)
  const order = getDOOrder(orderId)

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const errors: string[] = []

  try {
    await appendToLoadBoard(order)
  } catch (err) {
    console.error('[wfdo-resync] Load Board write failed:', err)
    errors.push('load_board_failed')
  }

  try {
    await appendToMasterList(order)
  } catch (err) {
    console.error('[wfdo-resync] Master List write failed:', err)
    errors.push('master_list_failed')
  }

  return NextResponse.json({ ok: true, errors: errors.length > 0 ? errors : undefined })
}
