'use client'

import { useState } from 'react'
import { WFDOOrder } from '@/lib/types'
import { WFDORedactEditor } from './WFDORedactEditor'

export function WFDOPendingQueue({ orders }: { orders: WFDOOrder[] }) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<WFDOOrder>>>({})
  const [approving, setApproving] = useState<string | null>(null)
  const [approveError, setApproveError] = useState<Record<string, string>>({})

  const pending = orders.filter(
    (o) => o.status === 'pending_redaction' || o.status === 'needs_manual_review'
  )

  function getField<K extends keyof WFDOOrder>(o: WFDOOrder, key: K): WFDOOrder[K] {
    return (edits[o.id]?.[key] ?? o[key]) as WFDOOrder[K]
  }

  function setField(id: string, key: keyof WFDOOrder, value: string) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  function buildEmailSubject(o: WFDOOrder): string {
    return `Delivery Order — ${getField(o, 'containerNumber')} — ${getField(o, 'consignee')}`
  }

  function buildEmailBody(o: WFDOOrder): string {
    const notes = String(getField(o, 'carrierNotes') ?? '').trim()
    return [
      'Please find attached the redacted Delivery Order for the following shipment:',
      '',
      `Container #:       ${getField(o, 'containerNumber')}`,
      `Master BL:         ${getField(o, 'masterBL')}`,
      `Arrival Date:      ${getField(o, 'arrivalDate')}`,
      `Consignee:         ${getField(o, 'consignee')}`,
      `Consignee Address: ${getField(o, 'consigneeAddress')}`,
      `Port / Location:   ${getField(o, 'portLocation')}`,
      `Cargo:             ${getField(o, 'cargoDescription')}`,
      `Packages:          ${getField(o, 'packages')}`,
      `Weight:            ${getField(o, 'weightKg')} kg`,
      `Seal #:            ${getField(o, 'sealNumber')}`,
      ...(notes ? ['', notes] : []),
      '',
      'Please confirm receipt.',
      '',
      'Regards,',
      'ARL-Trans',
    ].join('\n')
  }

  async function handleCopySubject(o: WFDOOrder) {
    await navigator.clipboard.writeText(buildEmailSubject(o))
    setCopied(`subject-${o.id}`)
    setTimeout(() => setCopied((prev) => (prev === `subject-${o.id}` ? null : prev)), 2000)
  }

  async function handleCopyBody(o: WFDOOrder) {
    await navigator.clipboard.writeText(buildEmailBody(o))
    setCopied(`body-${o.id}`)
    setTimeout(() => setCopied((prev) => (prev === `body-${o.id}` ? null : prev)), 2000)
  }

  async function handleApprove(o: WFDOOrder) {
    const merged = { ...o, ...(edits[o.id] ?? {}) }
    if (!merged.carrierEmail) {
      setApproveError((prev) => ({ ...prev, [o.id]: 'Carrier email is required before sending.' }))
      return
    }
    setApproving(o.id)
    setApproveError((prev) => { const n = { ...prev }; delete n[o.id]; return n })
    try {
      const res = await fetch(`/api/wfdo-approve/${encodeURIComponent(o.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      window.location.reload()
    } catch (err) {
      setApproveError((prev) => ({ ...prev, [o.id]: String(err) }))
    } finally {
      setApproving(null)
    }
  }

  async function handleReRedact(o: WFDOOrder) {
    await fetch(`/api/wfdo-re-redact/${encodeURIComponent(o.id)}`, { method: 'POST' })
    window.location.reload()
  }

  async function handleDownloadPdf(o: WFDOOrder) {
    setDownloading(o.id)
    const res = await fetch(`/api/wfdo-pdf/${encodeURIComponent(o.id)}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${o.containerNumber}-redacted.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
    setDownloading(null)
  }

  if (pending.length === 0)
    return <p className="text-sm text-gray-400">No pending delivery orders.</p>

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Pending Review ({pending.length})
      </h2>
      {pending.map((o) => (
        <div
          key={o.id}
          className={`bg-white rounded-xl shadow-sm p-5 space-y-4 ${
            o.status === 'needs_manual_review' ? 'border border-amber-200' : ''
          }`}
        >
          {o.status === 'needs_manual_review' && (
            <div className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-1.5">
              AI could not detect text in this PDF. Please review manually and approve or skip.
            </div>
          )}

          <WFDORedactEditor orderId={o.id} containerNumber={o.containerNumber} />

          {/* Editable fields — 2-column grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                { label: 'Container #', key: 'containerNumber' },
                { label: 'Master BL', key: 'masterBL' },
                { label: 'Arrival Date', key: 'arrivalDate' },
                { label: 'Port / Location', key: 'portLocation' },
                { label: 'Consignee', key: 'consignee' },
                { label: 'Cargo', key: 'cargoDescription' },
                { label: 'Packages', key: 'packages' },
                { label: 'Weight (Kg)', key: 'weightKg' },
                { label: 'Carrier Email', key: 'carrierEmail' },
              ] as { label: string; key: keyof WFDOOrder }[]
            ).map(({ label, key }) => (
              <div key={key}>
                <label className="text-xs text-gray-400 block mb-0.5">{label}</label>
                <input
                  type="text"
                  value={String(getField(o, key) ?? '')}
                  onChange={(e) => setField(o.id, key, e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs text-gray-400 block mb-0.5">Notes to Carrier (optional)</label>
              <textarea
                value={String(getField(o, 'carrierNotes') ?? '')}
                onChange={(e) => setField(o.id, 'carrierNotes', e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
          </div>

          {/* Email preview */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
            <p className="font-medium text-gray-500 uppercase tracking-wide text-[10px] mb-1">Email draft</p>
            <p className="font-medium">Subject: {buildEmailSubject(o)}</p>
            <pre className="whitespace-pre-wrap font-sans leading-relaxed text-gray-600">
              {buildEmailBody(o)}
            </pre>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <button
              onClick={() => handleApprove(o)}
              disabled={approving === o.id}
              className="text-xs font-medium text-white bg-green-600 rounded-full px-4 py-1.5 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {approving === o.id ? 'Sending…' : 'Approve & Send'}
            </button>
            <button
              onClick={() => handleReRedact(o)}
              className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 hover:bg-gray-100 transition-colors"
            >
              Re-redact
            </button>
            <button
              onClick={() => handleDownloadPdf(o)}
              disabled={downloading === o.id}
              className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {downloading === o.id ? 'Downloading…' : 'Download PDF'}
            </button>
            <button
              onClick={() => handleCopySubject(o)}
              className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 hover:bg-blue-100 transition-colors"
            >
              {copied === `subject-${o.id}` ? '✓ Copied!' : 'Copy Subject'}
            </button>
            <button
              onClick={() => handleCopyBody(o)}
              className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 hover:bg-blue-100 transition-colors"
            >
              {copied === `body-${o.id}` ? '✓ Copied!' : 'Copy Body'}
            </button>
          </div>
          {approveError[o.id] && (
            <p className="text-xs text-red-600 mt-1">{approveError[o.id]}</p>
          )}
        </div>
      ))}
    </div>
  )
}
