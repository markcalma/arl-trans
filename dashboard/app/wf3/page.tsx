import { getTodayInvoices, getWF3Resolved } from '@/lib/storage'
import { WF3SummaryBar } from '@/components/WF3SummaryBar'
import { WF3InvoicesTable } from '@/components/WF3InvoicesTable'
import { LogoutButton } from '@/components/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function WF3Page() {
  const day = getTodayInvoices()
  const resolved = getWF3Resolved()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-5">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ARL-Trans · Invoice Review</h1>
            <p className="text-sm text-gray-400 mt-1">WF3 — Carrier invoice processing</p>
          </div>
          <LogoutButton />
        </div>
        <WF3SummaryBar day={day} resolved={resolved} />
        <WF3InvoicesTable invoices={day.invoices} resolved={resolved} />
      </div>
    </main>
  )
}
