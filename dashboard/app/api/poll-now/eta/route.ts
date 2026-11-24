import { NextRequest, NextResponse } from 'next/server'
import { runETAUpdatePoll } from '@/lib/poller'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const result = await runETAUpdatePoll(Boolean(body.force))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
