import { NextRequest, NextResponse } from 'next/server'
import { addWF3Resolved } from '@/lib/storage'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  addWF3Resolved(decodeURIComponent(id))
  return NextResponse.json({ ok: true })
}
