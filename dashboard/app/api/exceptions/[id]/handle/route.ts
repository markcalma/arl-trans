import { NextRequest, NextResponse } from 'next/server'
import { addHandled } from '@/lib/storage'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  addHandled(decodeURIComponent(id))
  return NextResponse.json({ ok: true })
}
