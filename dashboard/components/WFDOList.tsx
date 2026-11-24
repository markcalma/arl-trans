'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
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

function StageBar({ stage }: { stage: Stage }) {
  const steps: { key: Stage; label: string }[] = [
    { key: 'redact', label: 'Redact' },
    { key: 'review', label: 'Review' },
    { key: 'send',   label: 'Send' },
  ]
  const activeIdx = steps.findIndex((s) => s.key === stage)

  return (
    <div className="flex items-center gap-1 select-none">
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1">
          <span className={`text-[12px] font-medium px-3 py-1 rounded-full transition-colors ${
            i < activeIdx  ? 'text-muted' :
            i === activeIdx ? 'bg-gray-900 text-white' :
            'text-gray-300'
          }`}>
            {i + 1} · {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className={`text-[12px] ${i < activeIdx ? 'text-muted' : 'text-gray-200'}`}>→</span>
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
  const [resyncingId, setResyncingId] = useState<string | null>(null)
  const [resyncResult, setResyncResult] = useState<Record<string, { ok: boolean; errors?: string[] }>>({})


  const pendingOrders = orders.filter(isPending)
  const sentOrders = orders.filter(isSent)
  const visible =
    tab === 'pending' ? pendingOrders :
    tab === 'sent'    ? sentOrders :
    orders

  function getStage(id: string, hasPdf: boolean): Stage {
    return stages[id] ?? (hasPdf ? 'redact' : 'review')
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

  async function handleResync(id: string) {
    setResyncingId(id)
    setResyncResult((prev) => { const n = { ...prev }; delete n[id]; return n })
    try {
      const res = await fetch(`/api/wfdo-resync/${encodeURIComponent(id)}`, { method: 'POST' })
      const data = await res.json()
      setResyncResult((prev) => ({ ...prev, [id]: { ok: res.ok && data.ok, errors: data.errors } }))
    } catch (err) {
      setResyncResult((prev) => ({ ...prev, [id]: { ok: false, errors: [String(err)] } }))
    } finally {
      setResyncingId(null)
    }
  }

  async function handleCopy(key: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 2000)
  }

  const tabDefs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: pendingOrders.length },
    { key: 'sent',    label: 'Sent',    count: sentOrders.length },
    { key: 'all',     label: 'All',     count: orders.length },
  ]

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1">
        {tabDefs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-[13px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
              tab === key ? 'bg-gray-900 text-white' : 'text-muted hover:text-foreground hover:bg-white'
            }`}
          >
            {label}
            <span className="ml-1.5 text-[11px] opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-12 text-center">
          <p className="text-[14px] text-muted">No delivery orders to show.</p>
        </div>
      )}

      {visible.map((o) => {
        const isExpanded = expandedId === o.id
        const hasPdf = Boolean(o.pdfPath)
        const stage = getStage(o.id, hasPdf)
        const pending = isPending(o)
        const sent = isSent(o)
        const subStatus = pending
          ? (stage !== 'redact' ? 'Ready to send' : 'Awaiting redaction')
          : null

        return (
          <div
            key={o.id}
            className={`bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden ${
              o.status === 'needs_manual_review' ? 'ring-1 ring-amber-200' : ''
            }`}
          >
            {/* Collapsed row */}
            <button
              onClick={() => toggleExpand(o.id)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-background transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="font-mono text-[13px] font-semibold text-foreground shrink-0">
                  {o.containerNumber || '(no #)'}
                </span>
                <span className="text-[13px] text-foreground truncate">{o.consignee || '—'}</span>
                <span className="text-[12px] text-muted shrink-0 hidden sm:block">{o.portLocation || '—'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {subStatus && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    subStatus === 'Ready to send'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {subStatus}
                  </span>
                )}
                {sent && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    Sent
                  </span>
                )}
                <span className="text-[12px] text-muted">{new Date(o.receivedAt).toLocaleDateString()}</span>
                <ChevronDown
                  size={16}
                  className={`text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-background px-5 py-4 space-y-4">
                {/* Meta */}
                <p className="text-[12px] text-muted">
                  From: {o.sender} · {new Date(o.receivedAt).toLocaleString()} · {o.subject}
                </p>

                {o.status === 'needs_manual_review' && (
                  <div className="text-[12px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    AI could not detect text in this PDF. Please review fields manually before marking as sent.
                  </div>
                )}

                {/* ── Pending: 3-stage flow ── */}
                {pending && (
                  <>
                    <StageBar stage={stage} />

                    {/* Stage 1 & 2: redact editor — only for PDF orders, hidden during send */}
                    {hasPdf && (
                      <div className={stage === 'send' ? 'hidden' : ''}>
                        <WFDORedactEditor
                          orderId={o.id}
                          containerNumber={o.containerNumber}
                          onApplied={() => setStage(o.id, 'review')}
                          onReset={() => setStage(o.id, 'redact')}
                        />
                      </div>
                    )}

                    {/* Stage 2: editable fields */}
                    {stage === 'review' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          {(
                            [
                              { label: 'Container #',     key: 'containerNumber' },
                              { label: 'Master BL',       key: 'masterBL' },
                              { label: 'Arrival Date',    key: 'arrivalDate' },
                              { label: 'Port / Location', key: 'portLocation' },
                              { label: 'Consignee',       key: 'consignee' },
                              { label: 'Customer',        key: 'customer' },
                              { label: 'Cargo',           key: 'cargoDescription' },
                              { label: 'Packages',        key: 'packages' },
                              { label: 'Weight (Kg)',     key: 'weightKg' },
                              { label: 'Carrier Email',   key: 'carrierEmail' },
                            ] as { label: string; key: keyof WFDOOrder }[]
                          ).map(({ label, key }) => (
                            <div key={key}>
                              <label className="text-[11px] font-medium text-muted block mb-1">{label}</label>
                              <input
                                type="text"
                                value={String(getField(o, key) ?? '')}
                                onChange={(e) => setField(o.id, key, e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                              />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className="text-[11px] font-medium text-muted block mb-1">Notes to Carrier (optional)</label>
                            <textarea
                              value={String(getField(o, 'carrierNotes') ?? '')}
                              onChange={(e) => setField(o.id, 'carrierNotes', e.target.value)}
                              rows={2}
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => setStage(o.id, 'send')}
                            className="text-[12px] font-medium text-white bg-blue-600 rounded-full px-4 py-1.5 hover:bg-blue-700 transition-colors"
                          >
                            Next: Prepare to Send →
                          </button>
                        </div>
                      </>
                    )}

                    {/* Stage 3: send panel */}
                    {stage === 'send' && (
                      <>
                        <div className="rounded-xl border border-background bg-background p-4 text-[12px] text-foreground space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">Email draft</p>
                          <p className="font-semibold">Subject: {buildSubject(o)}</p>
                          <pre className="whitespace-pre-wrap font-sans leading-relaxed text-muted mt-2">{buildBody(o)}</pre>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {hasPdf && (
                            <button
                              onClick={() => handleDownloadPdf(o)}
                              disabled={downloading === o.id}
                              className="text-[12px] font-medium text-foreground bg-white border border-gray-200 rounded-full px-4 py-1.5 hover:bg-background transition-colors disabled:opacity-50"
                            >
                              {downloading === o.id ? 'Downloading…' : 'Download PDF'}
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(`subject-${o.id}`, buildSubject(o))}
                            className="text-[12px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 hover:bg-blue-100 transition-colors"
                          >
                            {copied === `subject-${o.id}` ? '✓ Copied!' : 'Copy Subject'}
                          </button>
                          <button
                            onClick={() => handleCopy(`body-${o.id}`, buildBody(o))}
                            className="text-[12px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 hover:bg-blue-100 transition-colors"
                          >
                            {copied === `body-${o.id}` ? '✓ Copied!' : 'Copy Body'}
                          </button>
                          {hasPdf && (
                            <button
                              onClick={() => handleReRedact(o)}
                              className="text-[12px] font-medium text-muted bg-white border border-gray-200 rounded-full px-4 py-1.5 hover:bg-background transition-colors"
                            >
                              Re-redact
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3 pt-2 border-t border-background">
                          <button
                            onClick={() => setStage(o.id, 'review')}
                            className="text-[12px] text-muted hover:text-foreground transition-colors"
                          >
                            ← Back to Review
                          </button>
                          <button
                            onClick={() => handleMarkSent(o)}
                            disabled={markingId === o.id}
                            className="text-[12px] font-medium text-white bg-green-600 rounded-full px-5 py-1.5 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                          >
                            {markingId === o.id ? 'Saving…' : 'Mark as Sent'}
                          </button>
                        </div>

                        {markError[o.id] && (
                          <p className="text-[12px] text-red-600">{markError[o.id]}</p>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ── Sent: read-only summary ── */}
                {sent && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-y-3">
                      {[
                        { label: 'Consignee',      value: o.consignee },
                        { label: 'Master BL',      value: o.masterBL },
                        { label: 'Port / Location',value: o.portLocation },
                        { label: 'Carrier Email',  value: o.carrierEmail },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[11px] font-medium text-muted">{label}</p>
                          <p className="text-[13px] text-foreground mt-0.5">{value || '—'}</p>
                        </div>
                      ))}
                      <div className="col-span-2">
                        <p className="text-[11px] font-medium text-muted">Marked Sent</p>
                        <p className="text-[13px] text-foreground mt-0.5">
                          {o.sentAt ? new Date(o.sentAt).toLocaleString() : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-background">
                      <button
                        onClick={() => handleResync(o.id)}
                        disabled={resyncingId === o.id}
                        className="text-[12px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        {resyncingId === o.id ? 'Syncing…' : 'Re-sync to Sheets'}
                      </button>
                      {resyncResult[o.id] && (
                        <span className={`text-[11px] rounded-lg px-2.5 py-1 ${
                          resyncResult[o.id].ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {resyncResult[o.id].ok ? '✓ Synced' : `Error: ${resyncResult[o.id].errors?.join(', ')}`}
                        </span>
                      )}
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
