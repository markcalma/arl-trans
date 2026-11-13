import { NextResponse } from 'next/server'
import { runDoPoll } from '@/lib/poller'

export async function POST() {
  try {
    const result = await runDoPoll()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
