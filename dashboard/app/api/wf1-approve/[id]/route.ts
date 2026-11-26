import { NextRequest, NextResponse } from 'next/server'
import { getWF1Batch, updateWF1BatchStatus } from '@/lib/db'
import { upsertWF1ContainersToLoadBoard, upsertWF1ContainersToMasterList } from '@/lib/sheets'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const batch = getWF1Batch(id)

  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }
  if (batch.status !== 'pending_review') {
    return NextResponse.json({ error: 'Batch already processed' }, { status: 400 })
  }

  const now = new Date().toISOString()
  // Team Three batches only write to Load Board — MCL is updated via WF-DO when DO arrives
  const isTeamThree = batch.sourceFormat === 'team3'

  const [lbResult, mlResult] = await Promise.allSettled([
    upsertWF1ContainersToLoadBoard(batch.containers),
    isTeamThree ? Promise.resolve({ written: 0, updated: 0, errors: [], tabs: {} }) : upsertWF1ContainersToMasterList(batch.containers),
  ])

  const lbData = lbResult.status === 'fulfilled' ? lbResult.value : { written: 0, updated: 0, errors: [String((lbResult as PromiseRejectedResult).reason)], tabs: {} }
  const mlData = mlResult.status === 'fulfilled' ? mlResult.value : { written: 0, updated: 0, errors: [String((mlResult as PromiseRejectedResult).reason)], tabs: {} }

  const allErrors = [...lbData.errors, ...mlData.errors]

  updateWF1BatchStatus(id, 'approved', { reviewedAt: now, sheetsWrittenAt: now })

  return NextResponse.json({
    ok: true,
    loadBoard: { written: lbData.written, updated: lbData.updated, tabs: lbData.tabs },
    masterList: isTeamThree ? undefined : { written: mlData.written, updated: mlData.updated, tabs: mlData.tabs },
    errors: allErrors.length > 0 ? allErrors : undefined,
  })
}
