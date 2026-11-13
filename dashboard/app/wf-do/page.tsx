import { getAllDOOrders } from '@/lib/db'
import { WFDOList } from '@/components/WFDOList'

export const dynamic = 'force-dynamic'

export default async function WFDOPage() {
  const orders = getAllDOOrders()

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">DO Redaction</h1>
        <p className="text-sm text-muted mt-0.5">WF-DO — Delivery order redaction &amp; dispatch</p>
      </div>
      <WFDOList orders={orders} />
    </div>
  )
}
