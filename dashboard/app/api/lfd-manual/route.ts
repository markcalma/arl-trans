import { NextRequest, NextResponse } from 'next/server'
import { getLFDEntries, saveLFDEntry, clearLFDEntries } from '@/lib/storage'

// n8n calls GET to fetch all manually entered LFDs before the 11am email run
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(getLFDEntries())
}

// Gary's browser calls POST to save a single LFD entry from the dashboard
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { containerNumber, lfd } = body

  if (!containerNumber || !lfd) {
    return NextResponse.json({ error: 'Missing containerNumber or lfd' }, { status: 400 })
  }

  saveLFDEntry({ containerNumber, lfd, savedAt: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}

// n8n calls DELETE after reading entries to reset for the next day
export async function DELETE(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  clearLFDEntries()
  return NextResponse.json({ ok: true })
}
