'use client'

import { useState } from 'react'
import { WF2Order } from '@/lib/types'

export function WF2OrdersTable({ orders }: { orders: WF2Order[] }) {
  const [expanded, setExpanded] = useState(false)

  const actioned = orders.filter((o) => o.status !== 'pending_review')
  const sorted = [...actioned].sort(
    (a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
  )

  const visible = expanded ? sorted : sorted.slice(0, 10)

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  if (actioned.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
          Orders Today (0)
        </h2>
        <p className="text-gray-400 text-sm">No orders processed yet today</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Orders Today ({actioned.length})
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Container</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Customer</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Destination</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Carrier</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Rate</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
            <th className="pb-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Time</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((o) => (
            <tr key={o.containerNumber} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{o.containerNumber}</td>
              <td className="py-3 pr-6 text-gray-500">{o.customer}</td>
              <td className="py-3 pr-6 text-gray-500">{o.destination}</td>
              <td className="py-3 pr-6 text-gray-500">{o.carrier || '—'}</td>
              <td className="py-3 pr-6 text-gray-500">{o.rate > 0 ? `$${o.rate}` : '—'}</td>
              <td className="py-3 pr-6">
                {o.status === 'processed' ? (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700">
                    Processed
                  </span>
                ) : o.status === 'pending_review' ? (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700">
                    Pending Review
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-orange-50 text-orange-700">
                    Exception
                  </span>
                )}
              </td>
              <td className="py-3 text-gray-400 text-xs">{formatTime(o.processedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {actioned.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${actioned.length} orders`}
        </button>
      )}
    </div>
  )
}
