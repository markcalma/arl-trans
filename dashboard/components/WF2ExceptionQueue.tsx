'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WF2Order } from '@/lib/types'

export function WF2ExceptionQueue({
  orders,
  handled,
}: {
  orders: WF2Order[]
  handled: string[]
}) {
  const router = useRouter()
  const [dismissedLocally, setDismissedLocally] = useState<string[]>([])

  const exceptions = orders.filter(
    (o) =>
      o.status === 'exception' &&
      !handled.includes(o.containerNumber) &&
      !dismissedLocally.includes(o.containerNumber)
  )

  async function handleDone(containerNumber: string) {
    setDismissedLocally((prev) => [...prev, containerNumber])
    await fetch(`/api/wf2-exceptions/${encodeURIComponent(containerNumber)}/handle`, {
      method: 'POST',
    })
    router.refresh()
  }

  if (exceptions.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-5" data-testid="wf2-exception-queue">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Exceptions ({exceptions.length})
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Container</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Customer</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Destination</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Reason</th>
            <th className="pb-3" />
          </tr>
        </thead>
        <tbody>
          {exceptions.map((o) => (
            <tr key={o.containerNumber} className="border-t border-gray-100">
              <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{o.containerNumber}</td>
              <td className="py-3 pr-6 text-gray-500">{o.customer}</td>
              <td className="py-3 pr-6 text-gray-500">{o.destination}</td>
              <td className="py-3 pr-6 text-gray-500 text-xs">{o.exceptionReason}</td>
              <td className="py-3">
                <button
                  onClick={() => handleDone(o.containerNumber)}
                  className="text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-3 py-1 hover:bg-green-100 transition-colors"
                >
                  ✓ Handled
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
