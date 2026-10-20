'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Container, LFDEntry } from '@/lib/types'

function daysFromToday(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((d.getTime() - today.getTime()) / 86400000)
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupByLocation(containers: Container[]): Record<string, Container[]> {
  const groups: Record<string, Container[]> = {}
  for (const c of containers) {
    const key = c.location || 'Unknown Location'
    if (!groups[key]) groups[key] = []
    groups[key].push(c)
  }
  return groups
}

export function LFDInputPanel({
  containers,
  savedEntries,
}: {
  containers: Container[]
  savedEntries: LFDEntry[]
}) {
  const INVALID_CONTAINERS = new Set(['127', '9655', '9665', '9668', '932963'])
  const needed = containers.filter((c) => !c.lfd && !INVALID_CONTAINERS.has(c.containerNumber))
  const initialSaved = new Set(savedEntries.map((e) => e.containerNumber))
  const initialDates = Object.fromEntries(savedEntries.map((e) => [e.containerNumber, e.lfd]))

  const router = useRouter()
  const [dates, setDates] = useState<Record<string, string>>(initialDates)
  const [saved, setSaved] = useState<Set<string>>(initialSaved)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (needed.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm text-gray-500">All LFDs entered — no input needed</span>
      </div>
    )
  }

  const groups = groupByLocation(needed)

  const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => {
    const aMin = Math.min(...a.map((c) => daysFromToday(c.eta) ?? 999))
    const bMin = Math.min(...b.map((c) => daysFromToday(c.eta) ?? 999))
    return aMin - bMin
  })

  const totalPending = needed.filter((c) => !saved.has(c.containerNumber)).length
  const urgentCount = needed.filter((c) => {
    const d = daysFromToday(c.eta)
    return d !== null && d >= 0 && d <= 3 && !saved.has(c.containerNumber)
  }).length

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  async function handleSave(containerNumber: string) {
    const lfd = dates[containerNumber]
    if (!lfd) return
    setSaving((prev) => new Set([...prev, containerNumber]))
    try {
      await fetch('/api/lfd-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerNumber, lfd }),
      })
      setSaved((prev) => new Set([...prev, containerNumber]))
      router.refresh()
    } finally {
      setSaving((prev) => {
        const next = new Set(prev)
        next.delete(containerNumber)
        return next
      })
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${totalPending > 0 ? 'bg-amber-400' : 'bg-green-500'}`} />
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">LFD Entry</h2>
          {totalPending > 0 ? (
            <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5 font-medium">
              {totalPending} pending
            </span>
          ) : (
            <span className="text-xs text-green-700 bg-green-50 rounded-full px-2.5 py-0.5 font-medium">
              All entered ✓
            </span>
          )}
          {urgentCount > 0 && (
            <span className="text-xs text-red-700 bg-red-50 rounded-full px-2.5 py-0.5 font-medium">
              {urgentCount} urgent
            </span>
          )}
        </div>
        {saved.size > 0 && totalPending > 0 && (
          <span className="text-xs text-gray-400">{saved.size} saved</span>
        )}
      </div>

      <div className="space-y-1">
        {sortedGroups.map(([location, locContainers]) => {
          const sortedContainers = [...locContainers].sort((a, b) => {
            return (daysFromToday(a.eta) ?? 999) - (daysFromToday(b.eta) ?? 999)
          })

          const pendingInGroup = sortedContainers.filter((c) => !saved.has(c.containerNumber)).length
          const urgentInGroup = sortedContainers.filter((c) => {
            const d = daysFromToday(c.eta)
            return d !== null && d >= 0 && d <= 3 && !saved.has(c.containerNumber)
          }).length
          const isOpen = expanded.has(location)
          const n = locContainers.length

          return (
            <div key={location} className="border border-gray-100 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleGroup(location)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium text-gray-700">{location}</span>
                  {pendingInGroup > 0 ? (
                    <span className="text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                      {pendingInGroup} pending
                    </span>
                  ) : (
                    <span className="text-xs text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                      Done ✓
                    </span>
                  )}
                  {urgentInGroup > 0 && (
                    <span className="text-xs text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                      {urgentInGroup} urgent
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{n} {n === 1 ? 'container' : 'containers'}</span>
                </div>
                <span className="text-gray-400 text-xs ml-2">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 border-t border-gray-100">
                  <table className="w-full text-sm mt-3">
                    <thead>
                      <tr>
                        <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wide">Container</th>
                        <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wide w-20">ETA</th>
                        <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wide">PO</th>
                        <th className="pb-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wide">LFD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedContainers.map((c, idx) => {
                        const isSaved = saved.has(c.containerNumber)
                        const isSaving = saving.has(c.containerNumber)
                        const days = daysFromToday(c.eta)
                        const isPast   = days !== null && days < 0
                        const isToday  = days === 0
                        const isUrgent = days !== null && days > 0 && days <= 3
                        const isSoon   = days !== null && days > 3 && days <= 7

                        return (
                          <tr key={`${c.containerNumber}-${idx}`} className="border-t border-gray-100">
                            <td className="py-2.5 pr-4 font-mono text-xs font-medium text-gray-900">
                              {c.containerNumber}
                            </td>
                            <td className="py-2.5 pr-4 text-xs">
                              <span className={
                                isUrgent ? 'text-red-600 font-semibold' :
                                isSoon   ? 'text-amber-600 font-medium' :
                                isToday  ? 'text-red-600 font-semibold' :
                                           'text-gray-400'
                              }>
                                {formatDate(c.eta)}
                                {isToday && (
                                  <span className="ml-1 font-normal text-red-400">(today)</span>
                                )}
                                {isUrgent && days !== null && (
                                  <span className="ml-1 font-normal text-red-400">({days}d)</span>
                                )}
                                {isPast && (
                                  <span className="ml-1 font-normal text-gray-400">(overdue)</span>
                                )}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-gray-400">{c.po || '—'}</td>
                            <td className="py-2.5">
                              {isSaved ? (
                                <span className="text-xs font-medium text-green-700">
                                  ✓ {dates[c.containerNumber]}
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={dates[c.containerNumber] || ''}
                                    onChange={(e) =>
                                      setDates((prev) => ({ ...prev, [c.containerNumber]: e.target.value }))
                                    }
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
                                  />
                                  <button
                                    onClick={() => handleSave(c.containerNumber)}
                                    disabled={!dates[c.containerNumber] || isSaving}
                                    className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {isSaving ? '…' : 'Save'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
