import { NextResponse } from 'next/server'
import { getAllWF1Batches } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const batches = getAllWF1Batches()
  return NextResponse.json(batches)
}
