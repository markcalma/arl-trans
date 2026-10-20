'use client'

import { useState } from 'react'
import { WF3Invoice } from '@/lib/types'

type Filter = 'needs-review' | 'all' | 'matched' | 'resolved'

export function WF3InvoicesTable({
  invoices,
  resolved,
}: {
  invoices: WF3Invoice[]
  resolved: string[]
}) {
  const [resolvedLocally, setResolvedLocally] = useState<string[]>([])
  const allResolved = [...resolved, ...resolvedLocally]

  function resolveKey(i: WF3Invoice) {
    return `${i.containerNumber}_${i.processedAt}`
  }

  const needsReviewCount = invoices.filter(
    (i) => i.status === 'discrepancy' && !allResolved.includes(resolveKey(i))
  ).length

  const [filter, setFilter] = useState<Filter>(needsReviewCount > 0 ? 'needs-review' : 'all')

  async function handleResolve(i: WF3Invoice) {
    const key = resolveKey(i)
    setResolvedLocally((prev) => [...prev, key])
    await fetch(`/api/wf3-discrepancies/${encodeURIComponent(key)}/resolve`, {
      method: 'POST',
    })
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const sorted = [...invoices].sort(
    (a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
  )

  const filtered = sorted.filter((i) => {
    const isResolved = allResolved.includes(resolveKey(i))
    if (filter === 'needs-review') return i.status === 'discrepancy' && !isResolved
    if (filter === 'matched') return i.status === 'matched'
    if (filter === 'resolved') return isResolved
    return true
  })

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'needs-review', label: 'Needs Review', count: needsReviewCount },
    { key: 'all', label: 'All', count: invoices.length },
    {
      key: 'matched',
      label: 'Matched',
      count: invoices.filter((i) => i.status === 'matched').length,
    },
    {
      key: 'resolved',
      label: 'Resolved',
      count: invoices.filter((i) => allResolved.includes(resolveKey(i))).length,
    },
  ]

  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <p className="text-gray-400 text-sm">No invoices processed today</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex gap-2 mb-5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-medium rounded-full px-3 py-1.5 transition-colors ${
              filter === f.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-4">No invoices in this category</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Container</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Carrier</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Invoiced</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Expected</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Reason</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
              <th className="pb-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const isResolved = allResolved.includes(resolveKey(i))
              return (
                <tr key={resolveKey(i)} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{i.containerNumber}</td>
                  <td className="py-3 pr-6 text-gray-500">{i.carrier}</td>
                  <td className="py-3 pr-6 text-gray-500">${i.invoicedAmount}</td>
                  <td className="py-3 pr-6 text-gray-500">${i.expectedRate}</td>
                  <td className="py-3 pr-6 text-gray-400 text-xs">{i.discrepancyReason || '—'}</td>
                  <td className="py-3 pr-6">
                    {i.status === 'matched' ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700">
                        Matched
                      </span>
                    ) : isResolved ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500">
                        ✓ Resolved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResolve(i)}
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100 hover:bg-orange-100 transition-colors"
                      >
                        Discrepancy — Resolve
                      </button>
                    )}
                  </td>
                  <td className="py-3 text-gray-400 text-xs">{formatTime(i.processedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
