'use client'

import { useState } from 'react'
import { Container } from '@/lib/types'

const LOCATIONS = ['All', 'Carson', 'Exton', 'NJ', 'Oakland', 'Ontario', 'Stockton', 'Vacaville']

export function ContainerTable({ containers }: { containers: Container[] }) {
  const [location, setLocation] = useState('All')
  const [sort, setSort] = useState<'eta' | 'lfd'>('lfd')
  const [expanded, setExpanded] = useState(false)

  const filtered = containers
    .filter((c) => location === 'All' || c.location === location)
    .sort((a, b) => (a[sort] > b[sort] ? 1 : -1))

  const visible = expanded ? filtered : filtered.slice(0, 10)

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Containers ({filtered.length})
        </h2>
        <div className="flex gap-2">
          <select
            value={location}
            onChange={(e) => { setLocation(e.target.value); setExpanded(false) }}
            className="text-xs bg-white border border-gray-200 text-gray-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'eta' | 'lfd')}
            className="text-xs bg-white border border-gray-200 text-gray-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            <option value="lfd">Sort: LFD</option>
            <option value="eta">Sort: ETA</option>
          </select>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Container</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Location</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">ETA</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">LFD</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">SSL</th>
            <th className="pb-3 text-xs font-medium text-gray-400 uppercase tracking-wide">PO</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((c) => (
            <tr key={c.containerNumber + c.eta} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{c.containerNumber}</td>
              <td className="py-3 pr-6 text-gray-500">{c.location}</td>
              <td className="py-3 pr-6 text-gray-500">{c.eta}</td>
              <td className="py-3 pr-6 text-gray-500">{c.lfd}</td>
              <td className="py-3 pr-6 text-gray-500">{c.terminal}</td>
              <td className="py-3 text-gray-400">{c.po}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${filtered.length} containers`}
        </button>
      )}
    </div>
  )
}
