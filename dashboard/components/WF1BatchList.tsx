'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WF1Batch } from '@/lib/types'

type BatchStatus = 'all' | 'pending_review' | 'approved' | 'rejected'

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_COLOR: Record<string, string> = {
  pending_review: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

interface TabResult { written: number; updated: number }
interface ApproveResult {
  loadBoard: { written: number; updated: number; tabs: Record<string, TabResult> }
  masterList: { written: number; updated: number; tabs: Record<string, TabResult> }
  errors?: string[]
}

export function WF1BatchList({ initialBatches }: { initialBatches: WF1Batch[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<BatchStatus>('pending_review')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ApproveResult | null>(null)

  function refresh() {
    router.refresh()
  }

  function approve(id: string) {
    setActionError(null)
    setLastResult(null)
    startTransition(async () => {
      const res = await fetch(`/api/wf1-approve/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error ?? 'Approve failed')
      } else {
        setLastResult(data)
        if (data.errors?.length) {
          setActionError(`${data.errors.length} error(s) during write — some containers may have been skipped`)
        }
      }
      refresh()
    })
  }

  function reject(id: string) {
    setActionError(null)
    setLastResult(null)
    startTransition(async () => {
      await fetch(`/api/wf1-reject/${id}`, { method: 'POST' })
      refresh()
    })
  }

  function resync(id: string) {
    setActionError(null)
    setLastResult(null)
    startTransition(async () => {
      const res = await fetch(`/api/wf1-resync/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error ?? 'Re-sync failed')
      } else {
        setLastResult(data)
        if (data.errors?.length) {
          setActionError(`${data.errors.length} error(s) during re-sync`)
        }
      }
      refresh()
    })
  }

  const filtered = initialBatches.filter((b) => filter === 'all' || b.status === filter)

  return (
    <div className="space-y-4">
      {lastResult && !actionError && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-semibold mb-2">Sheets updated</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-green-900 mb-1">
                Load Board — {lastResult.loadBoard.written} added, {lastResult.loadBoard.updated} updated
              </p>
              {Object.entries(lastResult.loadBoard.tabs).map(([tab, counts]) => (
                <p key={tab} className="text-xs text-green-700 pl-2">
                  {tab}: {counts.written} added, {counts.updated} updated
                </p>
              ))}
            </div>
            <div>
              <p className="font-medium text-green-900 mb-1">
                Master List — {lastResult.masterList.written} added, {lastResult.masterList.updated} updated
              </p>
              {Object.entries(lastResult.masterList.tabs).map(([tab, counts]) => (
                <p key={tab} className="text-xs text-green-700 pl-2">
                  {tab}: {counts.written} added, {counts.updated} updated
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Write completed with errors</p>
          {lastResult && (
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium mb-1">Load Board — {lastResult.loadBoard.written} added, {lastResult.loadBoard.updated} updated</p>
                {Object.entries(lastResult.loadBoard.tabs).map(([tab, counts]) => (
                  <p key={tab} className="text-xs pl-2">{tab}: {counts.written} added, {counts.updated} updated</p>
                ))}
              </div>
              <div>
                <p className="font-medium mb-1">Master List — {lastResult.masterList.written} added, {lastResult.masterList.updated} updated</p>
                {Object.entries(lastResult.masterList.tabs).map(([tab, counts]) => (
                  <p key={tab} className="text-xs pl-2">{tab}: {counts.written} added, {counts.updated} updated</p>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2">{actionError}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-100 pb-2">
        {(['pending_review', 'approved', 'rejected', 'all'] as BatchStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-sm px-3 py-1 rounded-md transition-colors ${
              filter === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABEL[s]}
            {s !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                {initialBatches.filter((b) => b.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No batches to show</p>
      ) : (
        filtered.map((batch) => (
          <div key={batch.id} className="bg-white border border-gray-100 rounded-lg overflow-hidden">
            {/* Batch header */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {batch.subject || '(no subject)'}
                  </span>
                  <span className={`text-xs border rounded px-1.5 py-0.5 ${STATUS_COLOR[batch.status]}`}>
                    {STATUS_LABEL[batch.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {batch.sender} · {new Date(batch.receivedAt).toLocaleString()} ·{' '}
                  {batch.containerCount} containers · {batch.sourceFormat}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setExpandedId(expandedId === batch.id ? null : batch.id)}
                  className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  {expandedId === batch.id ? 'Hide' : 'View'} containers
                </button>
                {batch.status === 'pending_review' && (
                  <>
                    <button
                      onClick={() => approve(batch.id)}
                      disabled={isPending}
                      className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      Approve → Sheets
                    </button>
                    <button
                      onClick={() => reject(batch.id)}
                      disabled={isPending}
                      className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:border-red-300 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                {batch.status === 'approved' && (
                  <div className="flex items-center gap-2">
                    {batch.sheetsWrittenAt && (
                      <span className="text-xs text-gray-400">
                        Written {new Date(batch.sheetsWrittenAt).toLocaleString()}
                      </span>
                    )}
                    <button
                      onClick={() => resync(batch.id)}
                      disabled={isPending}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:border-blue-300 disabled:opacity-50 transition-colors"
                    >
                      Re-sync to Sheets
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Container table (expanded) */}
            {expandedId === batch.id && (
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Container #', 'Destination', 'ETA', 'SSL', 'Size', 'BL #', 'PO #', 'Free Days', 'Terminal'].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {batch.containers.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-900 whitespace-nowrap">{c.containerNumber}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.destination || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.eta || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.sslLine || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.size || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.bl || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.po || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 text-center">{c.freeDays ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.terminal || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
