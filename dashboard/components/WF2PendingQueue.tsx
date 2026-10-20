'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WF2Order } from '@/lib/types'

export function WF2PendingQueue({ orders }: { orders: WF2Order[] }) {
  const router = useRouter()
  const [approvedLocally, setApprovedLocally] = useState<string[]>([])
  const [rejectedLocally, setRejectedLocally] = useState<string[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [editedRates, setEditedRates] = useState<Record<string, string>>({})

  const pending = orders.filter(
    (o) =>
      o.status === 'pending_review' &&
      !approvedLocally.includes(o.containerNumber) &&
      !rejectedLocally.includes(o.containerNumber)
  )

  function getRate(o: WF2Order): string {
    return editedRates[o.containerNumber] ?? String(o.carrierRate?.custTotal ?? o.rate)
  }

  async function handleApprove(order: WF2Order) {
    setLoading(order.containerNumber)
    await fetch(`/api/wf2-approve/${encodeURIComponent(order.containerNumber)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate: Number(getRate(order)) }),
    })
    setApprovedLocally((prev) => [...prev, order.containerNumber])
    setLoading(null)
    router.refresh()
  }

  async function handleReject(order: WF2Order) {
    setLoading(`reject-${order.containerNumber}`)
    await fetch(`/api/wf2-reject/${encodeURIComponent(order.containerNumber)}`, {
      method: 'POST',
    })
    setRejectedLocally((prev) => [...prev, order.containerNumber])
    setLoading(null)
    router.refresh()
  }

  if (pending.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-5" data-testid="wf2-pending-queue">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Pending Review ({pending.length})
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Container</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Customer</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Destination</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">TLN</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Carrier</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Cust Rate</th>
            <th className="pb-3" />
          </tr>
        </thead>
        <tbody>
          {pending.map((o) => (
            <tr key={`${o.containerNumber}_${o.processedAt}`} className="border-t border-gray-100">
              <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{o.containerNumber}</td>
              <td className="py-3 pr-6 text-gray-500">{o.customer}</td>
              <td className="py-3 pr-6 text-gray-500">{o.destination}</td>
              <td className="py-3 pr-6 text-gray-500 font-mono text-xs">{o.truckLoadNumber || '—'}</td>
              <td className="py-3 pr-6 text-gray-500">{o.carrier}</td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={getRate(o)}
                    onChange={(e) =>
                      setEditedRates((prev) => ({ ...prev, [o.containerNumber]: e.target.value }))
                    }
                    className="w-20 text-sm text-gray-900 border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  />
                </div>
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(o)}
                    disabled={loading === o.containerNumber}
                    className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    {loading === o.containerNumber ? 'Sending…' : '✓ Approve & Send'}
                  </button>
                  <button
                    onClick={() => handleReject(o)}
                    disabled={loading === `reject-${o.containerNumber}`}
                    className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors disabled:opacity-50"
                  >
                    {loading === `reject-${o.containerNumber}` ? '…' : 'Reject'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
