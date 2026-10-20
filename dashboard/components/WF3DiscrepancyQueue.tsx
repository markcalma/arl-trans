'use client'

import { useState } from 'react'
import { WF3Invoice } from '@/lib/types'

export function WF3DiscrepancyQueue({
  invoices,
  resolved,
}: {
  invoices: WF3Invoice[]
  resolved: string[]
}) {
  const [resolvedLocally, setResolvedLocally] = useState<string[]>([])

  const discrepancies = invoices.filter(
    (i) =>
      i.status === 'discrepancy' &&
      !resolved.includes(i.containerNumber) &&
      !resolvedLocally.includes(i.containerNumber)
  )

  async function handleResolved(containerNumber: string) {
    setResolvedLocally((prev) => [...prev, containerNumber])
    await fetch(`/api/wf3-discrepancies/${encodeURIComponent(containerNumber)}/resolve`, {
      method: 'POST',
    })
  }

  if (discrepancies.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-5" data-testid="wf3-discrepancy-queue">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Discrepancies ({discrepancies.length})
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Container</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Carrier</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Invoiced</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Expected</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Reason</th>
            <th className="pb-3" />
          </tr>
        </thead>
        <tbody>
          {discrepancies.map((i) => (
            <tr key={i.containerNumber} className="border-t border-gray-100">
              <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{i.containerNumber}</td>
              <td className="py-3 pr-6 text-gray-500">{i.carrier}</td>
              <td className="py-3 pr-6 text-gray-500">${i.invoicedAmount}</td>
              <td className="py-3 pr-6 text-gray-500">${i.expectedRate}</td>
              <td className="py-3 pr-6 text-gray-500 text-xs">{i.discrepancyReason}</td>
              <td className="py-3">
                <button
                  onClick={() => handleResolved(i.containerNumber)}
                  className="text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-3 py-1 hover:bg-green-100 transition-colors"
                >
                  ✓ Resolved
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
