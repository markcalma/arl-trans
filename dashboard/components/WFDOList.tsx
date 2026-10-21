'use client'

import { useState } from 'react'
import { WFDOOrder } from '@/lib/types'
import { WFDORedactEditor } from './WFDORedactEditor'

type Tab = 'pending' | 'sent' | 'all'
type Stage = 'redact' | 'review' | 'send'

function isPending(o: WFDOOrder) {
  return o.status === 'pending_redaction' || o.status === 'needs_manual_review'
}

function isSent(o: WFDOOrder) {
  return o.status === 'sent'
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function StageBar({ stage }: { stage: Stage }) {
  const steps: { key: Stage; label: string }[] = [
    { key: 'redact', label: 'Redact' },
    { key: 'review', label: 'Review' },
    { key: 'send',   label: 'Send' },
  ]
  const activeIdx = steps.findIndex((s) => s.key === stage)

  return (
    <div className="flex items-center gap-1 text-xs select-none">
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1">
          <span className={`px-3 py-1 rounded-full font-medium transition-colors ${
            i < activeIdx  ? 'text-gray-400' :
            i === activeIdx ? 'bg-gray-900 text-white' :
            'text-gray-300'
          }`}>
            {i + 1} · {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className={i < activeIdx ? 'text-gray-400' : 'text-gray-200'}>→</span>
          )}
        </span>
      ))}
    </div>
  )
}

export function WFDOList({ orders }: { orders: WFDOOrder[] }) {
  const [tab, setTab] = useState<Tab>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [stages, setStages] = useState<Record<string, Stage>>({})
  const [edits, setEdits] = useState<Record<string, Partial<WFDOOrder>>>({})
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [markError, setMarkError] = useState<Record<string, string>>({})
  const [downloading, setDownloading] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const pendingOrders = orders.filter(isPending)
  const sentOrders = orders.filter(isSent)
  const visible =
    tab === 'pending' ? pendingOrders :
    tab === 'sent'    ? sentOrders :
    orders

  function getStage(id: string): Stage {
    return stages[id] ?? 'redact'
  }

  function setStage(id: string, s: Stage) {
    setStages((prev) => ({ ...prev, [id]: s }))
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function getField<K extends keyof WFDOOrder>(o: WFDOOrder, key: K): WFDOOrder[K] {
    return (edits[o.id]?.[key] ?? o[key]) as WFDOOrder[K]
  }

  function setField(id: string, key: keyof WFDOOrder, value: string) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  function buildSubject(o: WFDOOrder) {
    return `Delivery Order — ${getField(o, 'containerNumber')} — ${getField(o, 'consignee')}`
  }

  function buildBody(o: WFDOOrder) {
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

  async function handleMarkSent(o: WFDOOrder) {
    const merged = { ...o, ...(edits[o.id] ?? {}) }
    setMarkingId(o.id)
    setMarkError((prev) => { const n = { ...prev }; delete n[o.id]; return n })
    try {
      const res = await fetch(`/api/wfdo-approve/${encodeURIComponent(o.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      window.location.reload()
    } catch (err) {
      setMarkError((prev) => ({ ...prev, [o.id]: String(err) }))
    } finally {
      setMarkingId(null)
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

  async function handleCopy(key: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 2000)
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: pendingOrders.length },
    { key: 'sent',    label: 'Sent',    count: sentOrders.length },
    { key: 'all',     label: 'All',     count: orders.length },
  ]

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-100 pb-2">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-sm px-3 py-1 rounded-md transition-colors ${
              tab === key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">No delivery orders to show.</p>
      )}

      {visible.map((o) => {
        const isExpanded = expandedId === o.id
        const stage = getStage(o.id)
        const pending = isPending(o)
        const sent = isSent(o)
        const subStatus = pending
          ? (stage !== 'redact' ? 'Ready to send' : 'Awaiting redaction')
          : null

        return (
          <div
            key={o.id}
            className={`bg-white rounded-xl shadow-sm overflow-hidden ${
              o.status === 'needs_manual_review' ? 'ring-1 ring-amber-200' : ''
            }`}
          >
            {/* Collapsed row */}
            <button
              onClick={() => toggleExpand(o.id)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="font-mono text-sm font-semibold text-gray-900 shrink-0">
                  {o.containerNumber || '(no #)'}
                </span>
                <span className="text-sm text-gray-600 truncate">{o.consignee || '—'}</span>
                <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{o.portLocation || '—'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {subStatus && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    subStatus === 'Ready to send'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {subStatus}
                  </span>
                )}
                {sent && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    Sent
                  </span>
                )}
                <span className="text-xs text-gray-400">{new Date(o.receivedAt).toLocaleDateString()}</span>
                <Chevron expanded={isExpanded} />
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                {/* Meta */}
                <p className="text-xs text-gray-400">
                  From: {o.sender} · {new Date(o.receivedAt).toLocaleString()} · {o.subject}
                </p>

                {o.status === 'needs_manual_review' && (
                  <div className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-1.5">
                    AI could not detect text in this PDF. Please review fields manually before marking as sent.
                  </div>
                )}

                {/* ── Pending: 3-stage flow ── */}
                {pending && (
                  <>
                    <StageBar stage={stage} />

                    {/* Stage 1 & 2: redact editor — always mounted, hidden only during send */}
                    <div className={stage === 'send' ? 'hidden' : ''}>
                      <WFDORedactEditor
                        orderId={o.id}
                        containerNumber={o.containerNumber}
                        onApplied={() => setStage(o.id, 'review')}
                        onReset={() => setStage(o.id, 'redact')}
                      />
                    </div>

                    {/* Stage 2: editable fields */}
                    {stage === 'review' && (
                      <>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {(
                            [
                              { label: 'Container #',     key: 'containerNumber' },
                              { label: 'Master BL',       key: 'masterBL' },
                              { label: 'Arrival Date',    key: 'arrivalDate' },
                              { label: 'Port / Location', key: 'portLocation' },
                              { label: 'Consignee',       key: 'consignee' },
                              { label: 'Cargo',           key: 'cargoDescription' },
                              { label: 'Packages',        key: 'packages' },
                              { label: 'Weight (Kg)',     key: 'weightKg' },
                              { label: 'Carrier Email',   key: 'carrierEmail' },
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
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => setStage(o.id, 'send')}
                            className="text-xs font-medium text-white bg-gray-900 rounded-full px-4 py-1.5 hover:bg-gray-700 transition-colors"
                          >
                            Next: Prepare to Send →
                          </button>
                        </div>
                      </>
                    )}

                    {/* Stage 3: send panel */}
                    {stage === 'send' && (
                      <>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                          <p className="font-medium text-gray-500 uppercase tracking-wide text-[10px] mb-1">Email draft</p>
                          <p className="font-medium">Subject: {buildSubject(o)}</p>
                          <pre className="whitespace-pre-wrap font-sans leading-relaxed text-gray-600">{buildBody(o)}</pre>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleDownloadPdf(o)}
                            disabled={downloading === o.id}
                            className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 hover:bg-gray-100 transition-colors disabled:opacity-50"
                          >
                            {downloading === o.id ? 'Downloading…' : 'Download PDF'}
                          </button>
                          <button
                            onClick={() => handleCopy(`subject-${o.id}`, buildSubject(o))}
                            className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 hover:bg-blue-100 transition-colors"
                          >
                            {copied === `subject-${o.id}` ? '✓ Copied!' : 'Copy Subject'}
                          </button>
                          <button
                            onClick={() => handleCopy(`body-${o.id}`, buildBody(o))}
                            className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 hover:bg-blue-100 transition-colors"
                          >
                            {copied === `body-${o.id}` ? '✓ Copied!' : 'Copy Body'}
                          </button>
                          <button
                            onClick={() => handleReRedact(o)}
                            className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 hover:bg-gray-100 transition-colors"
                          >
                            Re-redact
                          </button>
                        </div>

                        <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                          <button
                            onClick={() => setStage(o.id, 'review')}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            ← Back to Review
                          </button>
                          <button
                            onClick={() => handleMarkSent(o)}
                            disabled={markingId === o.id}
                            className="text-xs font-medium text-white bg-green-600 rounded-full px-5 py-1.5 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                          >
                            {markingId === o.id ? 'Saving…' : 'Mark as Sent'}
                          </button>
                        </div>

                        {markError[o.id] && (
                          <p className="text-xs text-red-600">{markError[o.id]}</p>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ── Sent: read-only summary ── */}
                {sent && (
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Consignee</p>
                      <p className="text-gray-700">{o.consignee || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Master BL</p>
                      <p className="text-gray-700">{o.masterBL || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Port / Location</p>
                      <p className="text-gray-700">{o.portLocation || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Carrier Email</p>
                      <p className="text-gray-700">{o.carrierEmail || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400">Marked Sent</p>
                      <p className="text-gray-700">{o.sentAt ? new Date(o.sentAt).toLocaleString() : '—'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
