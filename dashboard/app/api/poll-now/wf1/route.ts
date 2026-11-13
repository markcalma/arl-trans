import { NextResponse } from 'next/server'
import { runWF1Poll } from '@/lib/poller'

export async function POST() {
  try {
    const result = await runWF1Poll()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
