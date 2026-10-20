import { NextRequest, NextResponse } from 'next/server'
import { addWF2Handled } from '@/lib/storage'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  addWF2Handled(decodeURIComponent(id))
  return NextResponse.json({ ok: true })
}
