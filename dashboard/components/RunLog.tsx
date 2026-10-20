'use client'

import { useState } from 'react'
import { LogEntry } from '@/lib/types'

const ROW_CLASS: Record<string, string> = {
  ok: 'text-gray-500',
  warning: 'bg-amber-50 text-amber-700 rounded px-1',
  error: 'bg-red-50 text-red-600 rounded px-1',
}

const TIME_CLASS: Record<string, string> = {
  ok: 'text-gray-300',
  warning: 'text-amber-400',
  error: 'text-red-400',
}

export function RunLog({ log }: { log: LogEntry[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide w-full text-left hover:text-gray-600 transition-colors"
      >
        <span>{open ? '▾' : '▸'}</span>
        Run Log ({log.length} steps)
      </button>
      {open && (
        <div className="mt-4 space-y-1">
          {log.map((entry, i) => (
            <div key={i} className={`flex gap-3 text-xs py-0.5 ${ROW_CLASS[entry.status]}`}>
              <span className={`shrink-0 font-mono ${TIME_CLASS[entry.status]}`}>{entry.time}</span>
              <span>{entry.step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
