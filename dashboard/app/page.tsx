import { getAllWF1Batches } from '@/lib/db'
import { WF1BatchList } from '@/components/WF1BatchList'
import { AutoRefresh } from '@/components/AutoRefresh'

export const dynamic = 'force-dynamic'

export default async function WF1Page() {
  const batches = getAllWF1Batches()
  const pendingCount = batches.filter((b) => b.status === 'pending_review').length

  return (
    <div className="p-6 space-y-6">
      <AutoRefresh />

      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Water Report</h1>
        <p className="text-sm text-muted mt-0.5">
          Review incoming Amercare water reports before writing to Google Sheets
        </p>
      </div>

      <div>
        {pendingCount > 0 ? (
          <span className="inline-flex text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1">
            {pendingCount} batch{pendingCount !== 1 ? 'es' : ''} pending review
          </span>
        ) : (
          <span className="text-sm text-muted">No batches pending review</span>
        )}
      </div>

      <WF1BatchList initialBatches={batches} />
    </div>
  )
}
