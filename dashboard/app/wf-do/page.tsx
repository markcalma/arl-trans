import { getAllDOOrders } from '@/lib/db'
import { WFDOPendingQueue } from '@/components/WFDOPendingQueue'
import { WFDOSentTable } from '@/components/WFDOSentTable'
import { LogoutButton } from '@/components/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function WFDOPage() {
  const orders = getAllDOOrders()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-5">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ARL-Trans · DO Redaction</h1>
            <p className="text-sm text-gray-400 mt-1">WF-DO — Delivery order redaction &amp; dispatch</p>
          </div>
          <LogoutButton />
        </div>
        <WFDOPendingQueue orders={orders} />
        <WFDOSentTable orders={orders} />
      </div>
    </main>
  )
}
