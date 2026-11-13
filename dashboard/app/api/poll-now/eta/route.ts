import { NextResponse } from 'next/server'
import { runETAUpdatePoll } from '@/lib/poller'

export async function POST() {
  try {
    const result = await runETAUpdatePoll()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
