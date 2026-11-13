'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WF1Batch } from '@/lib/types'
import { ChevronDown, RefreshCw } from 'lucide-react'

type BatchStatus = 'all' | 'pending_review' | 'approved' | 'rejected'

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_COLOR: Record<string, string> = {
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

interface TabResult { written: number; updated: number }
interface ApproveResult {
  loadBoard: { written: number; updated: number; tabs: Record<string, TabResult> }
  masterList: { written: number; updated: number; tabs: Record<string, TabResult> }
  errors?: string[]
}

const FILTER_TABS: { key: BatchStatus; label: string }[] = [
  { key: 'pending_review', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

export function WF1BatchList({ initialBatches }: { initialBatches: WF1Batch[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<BatchStatus>('pending_review')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ApproveResult | null>(null)

  function refresh() { router.refresh() }

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
      {/* Result banner */}
      {lastResult && !actionError && (
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-green-100 px-5 py-4">
          <p className="text-[13px] font-semibold text-green-800 mb-2">Sheets updated successfully</p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[12px] font-medium text-foreground mb-1">
                Load Board — {lastResult.loadBoard.written} added, {lastResult.loadBoard.updated} updated
              </p>
              {Object.entries(lastResult.loadBoard.tabs).map(([tab, counts]) => (
                <p key={tab} className="text-[11px] text-muted pl-2">
                  {tab}: {counts.written} added, {counts.updated} updated
                </p>
              ))}
            </div>
            <div>
              <p className="text-[12px] font-medium text-foreground mb-1">
                Master List — {lastResult.masterList.written} added, {lastResult.masterList.updated} updated
              </p>
              {Object.entries(lastResult.masterList.tabs).map(([tab, counts]) => (
                <p key={tab} className="text-[11px] text-muted pl-2">
                  {tab}: {counts.written} added, {counts.updated} updated
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
      {actionError && (
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-red-100 px-5 py-4">
          <p className="text-[13px] font-semibold text-red-700 mb-1">Write completed with errors</p>
          {lastResult && (
            <div className="grid grid-cols-2 gap-6 mb-2">
              <div>
                <p className="text-[12px] font-medium text-foreground mb-1">Load Board — {lastResult.loadBoard.written} added, {lastResult.loadBoard.updated} updated</p>
                {Object.entries(lastResult.loadBoard.tabs).map(([tab, counts]) => (
                  <p key={tab} className="text-[11px] text-muted pl-2">{tab}: {counts.written} added, {counts.updated} updated</p>
                ))}
              </div>
              <div>
                <p className="text-[12px] font-medium text-foreground mb-1">Master List — {lastResult.masterList.written} added, {lastResult.masterList.updated} updated</p>
                {Object.entries(lastResult.masterList.tabs).map(([tab, counts]) => (
                  <p key={tab} className="text-[11px] text-muted pl-2">{tab}: {counts.written} added, {counts.updated} updated</p>
                ))}
              </div>
            </div>
          )}
          <p className="text-[12px] text-red-600">{actionError}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-[13px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
              filter === key
                ? 'bg-gray-900 text-white'
                : 'text-muted hover:text-foreground hover:bg-white'
            }`}
          >
            {label}
            {key !== 'all' && (
              <span className={`ml-1.5 text-[11px] ${filter === key ? 'opacity-70' : 'opacity-60'}`}>
                {initialBatches.filter((b) => b.status === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Batch list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-12 text-center">
          <p className="text-[14px] text-muted">No batches to show</p>
        </div>
      ) : (
        filtered.map((batch) => (
          <div
            key={batch.id}
            className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden"
          >
            {/* Batch header row */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-foreground truncate">
                    {batch.subject || '(no subject)'}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[batch.status]}`}>
                    {STATUS_LABEL[batch.status]}
                  </span>
                </div>
                <p className="text-[12px] text-muted mt-0.5">
                  {batch.sender} · {new Date(batch.receivedAt).toLocaleString()} ·{' '}
                  <span className="font-medium text-foreground">{batch.containerCount} containers</span> · {batch.sourceFormat}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setExpandedId(expandedId === batch.id ? null : batch.id)}
                  className="flex items-center gap-1 text-[12px] font-medium text-muted hover:text-foreground px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  {expandedId === batch.id ? 'Hide' : 'View'}
                  <ChevronDown
                    size={13}
                    className={`transition-transform ${expandedId === batch.id ? 'rotate-180' : ''}`}
                  />
                </button>
                {batch.status === 'pending_review' && (
                  <>
                    <button
                      onClick={() => approve(batch.id)}
                      disabled={isPending}
                      className="text-[12px] font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      Approve → Sheets
                    </button>
                    <button
                      onClick={() => reject(batch.id)}
                      disabled={isPending}
                      className="text-[12px] font-medium text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                {batch.status === 'approved' && (
                  <div className="flex items-center gap-2">
                    {batch.sheetsWrittenAt && (
                      <span className="text-[11px] text-muted">
                        {new Date(batch.sheetsWrittenAt).toLocaleString()}
                      </span>
                    )}
                    <button
                      onClick={() => resync(batch.id)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-200 hover:border-blue-300 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw size={12} />
                      Re-sync to Sheets
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Container table */}
            {expandedId === batch.id && (
              <div className="border-t border-background overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-background">
                      {['Container #', 'Destination', 'ETA', 'SSL', 'Size', 'BL #', 'PO #', 'Free Days', 'Terminal'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.5px] text-muted whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batch.containers.map((c, i) => (
                      <tr key={i} className="border-b border-background last:border-0 hover:bg-background">
                        <td className="px-4 py-2.5 font-mono text-[13px] font-medium text-foreground whitespace-nowrap">{c.containerNumber}</td>
                        <td className="px-4 py-2.5 text-[13px] text-foreground whitespace-nowrap">{c.destination || '—'}</td>
                        <td className="px-4 py-2.5 text-[13px] text-foreground whitespace-nowrap">{c.eta || '—'}</td>
                        <td className="px-4 py-2.5 text-[13px] text-foreground whitespace-nowrap">{c.sslLine || '—'}</td>
                        <td className="px-4 py-2.5 text-[13px] text-foreground whitespace-nowrap">{c.size || '—'}</td>
                        <td className="px-4 py-2.5 text-[13px] text-foreground whitespace-nowrap">{c.bl || '—'}</td>
                        <td className="px-4 py-2.5 text-[13px] text-foreground whitespace-nowrap">{c.po || '—'}</td>
                        <td className="px-4 py-2.5 text-[13px] text-foreground text-center">{c.freeDays ?? '—'}</td>
                        <td className="px-4 py-2.5 text-[13px] text-foreground whitespace-nowrap">{c.terminal || '—'}</td>
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
