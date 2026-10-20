import { NextResponse } from 'next/server'

// No longer used — DOs are ingested by the Gmail poller in lib/poller.ts
// (starts automatically on server boot via instrumentation.ts).
export async function POST() {
  return NextResponse.json({ error: 'Deprecated — DOs are now ingested by Gmail poller' }, { status: 410 })
}
