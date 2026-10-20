import { NextRequest, NextResponse } from 'next/server'
import { saveLatestRun } from '@/lib/storage'
import { WF1Run } from '@/lib/types'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const run = await req.json()
  saveLatestRun(run as WF1Run)

  return NextResponse.json({ ok: true })
}
