import { WF2Day } from '@/lib/types'

export function WF2SummaryBar({
  day,
  handled,
}: {
  day: WF2Day
  handled: string[]
}) {
  if (day.orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        <span className="text-gray-400 text-sm">No orders received today</span>
      </div>
    )
  }

  const totalOrders = day.orders.length
  const pendingReview = day.orders.filter((o) => o.status === 'pending_review').length
  const rateConsSent = day.orders.filter((o) => o.status === 'processed').length
  const exceptionsPending = day.orders.filter(
    (o) => o.status === 'exception' && !handled.includes(o.containerNumber)
  ).length

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Today&apos;s Summary
      </h2>
      <div className="flex gap-10">
        <div>
          <p className="text-2xl font-semibold text-gray-900">{totalOrders}</p>
          <p className="text-xs text-gray-400 mt-1">Orders in</p>
        </div>
        <div>
          <p className={`text-2xl font-semibold ${pendingReview > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            {pendingReview}
          </p>
          <p className="text-xs text-gray-400 mt-1">Pending review</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-green-700">{rateConsSent}</p>
          <p className="text-xs text-gray-400 mt-1">Rate cons sent</p>
        </div>
        <div>
          <p className={`text-2xl font-semibold ${exceptionsPending > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {exceptionsPending}
          </p>
          <p className="text-xs text-gray-400 mt-1">Exceptions pending</p>
        </div>
      </div>
    </div>
  )
}
