'use client'

import { useState } from 'react'
import { Exception } from '@/lib/types'

export function ExceptionQueue({
  exceptions,
  handled,
}: {
  exceptions: Exception[]
  handled: string[]
}) {
  const [dismissedLocally, setDismissedLocally] = useState<string[]>([])

  const reuse = exceptions.filter(
    (e) =>
      e.type === 'reuse_load' &&
      !handled.includes(e.containerNumber) &&
      !dismissedLocally.includes(e.containerNumber)
  )
  const examFlags = exceptions.filter((e) => e.type === 'exam_flag')
  const total = reuse.length + examFlags.length

  async function handleDone(containerNumber: string) {
    setDismissedLocally((prev) => [...prev, containerNumber])
    await fetch(`/api/exceptions/${encodeURIComponent(containerNumber)}/handle`, {
      method: 'POST',
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5" data-testid="exception-queue">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Exceptions ({total})
      </h2>
      {total === 0 ? (
        <p className="text-gray-400 text-sm">No exceptions flagged</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Container</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Type</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Location</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody>
            {reuse.map((e) => (
              <tr key={e.containerNumber} className="border-t border-gray-100">
                <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{e.containerNumber}</td>
                <td className="py-3 pr-6">
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-orange-50 text-orange-700">
                    Reuse Load
                  </span>
                </td>
                <td className="py-3 pr-6 text-gray-500">{e.location}</td>
                <td className="py-3">
                  <button
                    onClick={() => handleDone(e.containerNumber)}
                    className="text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-3 py-1 hover:bg-green-100 transition-colors"
                  >
                    ✓ Done
                  </button>
                </td>
              </tr>
            ))}
            {examFlags.map((e) => (
              <tr key={e.containerNumber} className="border-t border-gray-100">
                <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{e.containerNumber}</td>
                <td className="py-3 pr-6">
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500">
                    Exam Flag
                  </span>
                </td>
                <td className="py-3 pr-6 text-gray-500">{e.location}</td>
                <td className="py-3 text-xs text-gray-400 italic">
                  Under customs hold — row skipped
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
