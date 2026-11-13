import { NextResponse } from 'next/server'
import { readPollerStatus } from '@/lib/poller-status'

export async function GET() {
  return NextResponse.json(readPollerStatus())
}
