import { getTodayOrders, getWF2Handled } from '@/lib/storage'
import { WF2SummaryBar } from '@/components/WF2SummaryBar'
import { WF2PendingQueue } from '@/components/WF2PendingQueue'
import { WF2ExceptionQueue } from '@/components/WF2ExceptionQueue'
import { WF2OrdersTable } from '@/components/WF2OrdersTable'
import { LogoutButton } from '@/components/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function WF2Page() {
  const day = getTodayOrders()
  const handled = getWF2Handled()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-5">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ARL-Trans · Order Intake</h1>
            <p className="text-sm text-gray-400 mt-1">WF2 — Delivery order processing</p>
          </div>
          <LogoutButton />
        </div>
        <WF2SummaryBar day={day} handled={handled} />
        <WF2PendingQueue orders={day.orders} />
        <WF2ExceptionQueue orders={day.orders} handled={handled} />
        <WF2OrdersTable orders={day.orders} />
      </div>
    </main>
  )
}
