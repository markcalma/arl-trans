import { NextResponse } from 'next/server'
import { getPendingDOOrders, getPendingWF1Batches } from '@/lib/db'

export async function GET() {
  const doCount = getPendingDOOrders().length
  const wf1Count = getPendingWF1Batches().length
  return NextResponse.json({ doCount, wf1Count })
}
