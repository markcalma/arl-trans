import { WF3Day } from '@/lib/types'

export function WF3SummaryBar({
  day,
  resolved,
}: {
  day: WF3Day
  resolved: string[]
}) {
  if (day.invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        <span className="text-gray-400 text-sm">No invoices processed today</span>
      </div>
    )
  }

  const totalInvoices = day.invoices.length
  const matched = day.invoices.filter((i) => i.status === 'matched').length
  const discrepanciesPending = day.invoices.filter(
    (i) => i.status === 'discrepancy' && !resolved.includes(`${i.containerNumber}_${i.processedAt}`)
  ).length

  return (
    <div data-testid="wf3-summary-bar" className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Today&apos;s Summary
      </h2>
      <div className="flex gap-10">
        <div>
          <p className="text-2xl font-semibold text-gray-900">{totalInvoices}</p>
          <p className="text-xs text-gray-400 mt-1">Invoices in</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-green-700">{matched}</p>
          <p className="text-xs text-gray-400 mt-1">Matched</p>
        </div>
        <div>
          <p className={`text-2xl font-semibold ${discrepanciesPending > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {discrepanciesPending}
          </p>
          <p className="text-xs text-gray-400 mt-1">Need Review</p>
        </div>
      </div>
    </div>
  )
}
