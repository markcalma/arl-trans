import { getAllWF1Batches } from '@/lib/db'
import { WF1BatchList } from '@/components/WF1BatchList'
import { LogoutButton } from '@/components/LogoutButton'
import { AutoRefresh } from '@/components/AutoRefresh'

export const dynamic = 'force-dynamic'

export default async function WF1Page() {
  const batches = getAllWF1Batches()
  const pendingCount = batches.filter((b) => b.status === 'pending_review').length

  return (
    <main className="min-h-screen bg-gray-50">
      <AutoRefresh />
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ARL-Trans · WF1 Water Report</h1>
            <p className="text-sm text-gray-400 mt-1">
              Review incoming Amercare water reports before writing to Google Sheets
            </p>
          </div>
          <LogoutButton />
        </div>

        <div>
          {pendingCount > 0 ? (
            <span className="text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-1">
              {pendingCount} batch{pendingCount !== 1 ? 'es' : ''} pending review
            </span>
          ) : (
            <span className="text-sm text-gray-400">No batches pending review</span>
          )}
        </div>

        <WF1BatchList initialBatches={batches} />
      </div>
    </main>
  )
}
