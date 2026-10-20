import { NextRequest, NextResponse } from 'next/server'
import { getWF1Batch, updateWF1BatchStatus } from '@/lib/db'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const batch = getWF1Batch(id)

  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  updateWF1BatchStatus(id, 'rejected', { reviewedAt: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}
