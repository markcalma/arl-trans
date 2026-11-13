'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, RefreshCw, Mail, Zap } from 'lucide-react'

interface GmailStatus {
  connected: boolean
  email?: string
  messagesTotal?: number
  error?: string
}

interface PollStat {
  lastRun: string | null
  lastIngested: number
  lastError: string | null
}

interface PollerStatus {
  wfdo: PollStat
  wf1: PollStat
  eta: PollStat
}

interface PollResult {
  ok: boolean
  ingested?: number
  processed?: number
  error: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AdminPage() {
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null)
  const [pollerStatus, setPollerStatus] = useState<PollerStatus | null>(null)
  const [connectResult, setConnectResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [pollResults, setPollResults] = useState<Record<string, PollResult | null>>({ wfdo: null, wf1: null, eta: null })
  const [polling, setPolling] = useState<Record<string, boolean>>({ wfdo: false, wf1: false, eta: false })

  const refreshStatus = useCallback(async () => {
    const [gmailRes, pollerRes] = await Promise.all([
      fetch('/api/auth/gmail/status').then(r => r.json()),
      fetch('/api/poller-status').then(r => r.json()),
    ])
    setGmailStatus(gmailRes)
    setPollerStatus(pollerRes)
  }, [])

  useEffect(() => {
    refreshStatus()
    // Handle redirect back from Google OAuth
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      setConnectResult({ ok: true })
      window.history.replaceState({}, '', '/admin')
      refreshStatus()
    } else if (params.get('error')) {
      setConnectResult({ ok: false, error: params.get('error')! })
      window.history.replaceState({}, '', '/admin')
    }
  }, [refreshStatus])

  async function handleConnectGmail() {
    const res = await fetch('/api/auth/gmail/connect')
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  async function handlePollNow(type: 'wfdo' | 'wf1' | 'eta') {
    setPolling(p => ({ ...p, [type]: true }))
    setPollResults(r => ({ ...r, [type]: null }))
    try {
      const res = await fetch(`/api/poll-now/${type}`, { method: 'POST' })
      const data = await res.json()
      setPollResults(r => ({ ...r, [type]: data }))
      refreshStatus()
    } finally {
      setPolling(p => ({ ...p, [type]: false }))
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin</h1>
        <p className="text-sm text-muted mt-0.5">Gmail connection and poller diagnostics</p>
      </div>

      {/* Gmail Connection */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-5 py-4 border-b border-background flex items-center gap-2">
          <Mail size={15} className="text-muted" />
          <h2 className="text-[14px] font-semibold text-foreground">Gmail Connection</h2>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Status row */}
          <div className="flex items-center gap-3">
            {gmailStatus === null ? (
              <span className="text-[13px] text-muted">Checking…</span>
            ) : gmailStatus.connected ? (
              <>
                <CheckCircle size={16} className="text-green-500 shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-foreground">{gmailStatus.email}</p>
                  <p className="text-[11px] text-muted">{gmailStatus.messagesTotal?.toLocaleString()} messages in inbox</p>
                </div>
                <button
                  onClick={refreshStatus}
                  className="ml-auto text-[12px] text-muted hover:text-foreground flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </>
            ) : (
              <>
                <XCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-[13px] text-foreground">Not connected{gmailStatus.error ? ` — ${gmailStatus.error}` : ''}</p>
              </>
            )}
          </div>

          {/* Connect button */}
          <div className="border border-background rounded-xl p-4 space-y-3">
            <p className="text-[12px] font-medium text-foreground">
              {gmailStatus?.connected ? 'Re-connect Gmail (use if tokens expired)' : 'Connect Gmail'}
            </p>
            <p className="text-[11px] text-muted leading-relaxed">
              Click the button below → sign in with the ops Gmail account → you&apos;ll be redirected back here automatically.
            </p>
            <button
              onClick={handleConnectGmail}
              className="text-[12px] font-medium text-white bg-blue-600 rounded-lg px-4 py-1.5 hover:bg-blue-700 transition-colors"
            >
              {gmailStatus?.connected ? 'Re-connect Gmail' : 'Connect Gmail'}
            </button>

            {connectResult && (
              <div className={`text-[12px] rounded-lg px-3 py-2 ${connectResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {connectResult.ok ? '✓ Gmail connected successfully' : `Error: ${connectResult.error}`}
              </div>
            )}
          </div>

          {/* Forwarding instructions */}
          <div className="bg-background rounded-xl px-4 py-3 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Email forwarding setup</p>
            <p className="text-[12px] text-foreground mt-1">
              For each team member receiving DOs or water reports: go to Gmail Settings → Forwarding → forward a copy to the ops inbox above.
              The app polls that one inbox — no other setup needed.
            </p>
          </div>
        </div>
      </div>

      {/* Poller */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-5 py-4 border-b border-background flex items-center gap-2">
          <Zap size={15} className="text-muted" />
          <h2 className="text-[14px] font-semibold text-foreground">Poller</h2>
          <span className="ml-auto text-[11px] text-muted">Runs automatically every 60s</span>
        </div>

        <div className="divide-y divide-background">
          {(
            [
              { key: 'wfdo' as const, label: 'WF-DO (Delivery Orders)', desc: 'Checks Gmail for DO PDFs/Excels' },
              { key: 'wf1'  as const, label: 'WF1 (Water Reports)',      desc: 'Checks Gmail for Amercare Excel files' },
              { key: 'eta'  as const, label: 'ETA Updates',              desc: 'Checks Gmail for arrival/appointment/LFD updates' },
            ]
          ).map(({ key, label, desc }) => {
            const stat = pollerStatus?.[key]
            const result = pollResults[key]
            const count = result ? (result.processed ?? result.ingested ?? 0) : 0
            return (
              <div key={key} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{label}</p>
                  <p className="text-[11px] text-muted mt-0.5">{desc}</p>
                  {stat && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      <span className="text-[11px] text-muted">
                        Last run: <span className="text-foreground font-medium">{timeAgo(stat.lastRun)}</span>
                        {stat.lastRun && (
                          <span className="text-muted ml-1">({new Date(stat.lastRun).toLocaleTimeString()})</span>
                        )}
                      </span>
                      {stat.lastRun && (
                        <span className="text-[11px] text-muted">
                          Last count: <span className="text-foreground font-medium">{stat.lastIngested}</span>
                        </span>
                      )}
                      {stat.lastError && (
                        <span className="text-[11px] text-red-600 truncate max-w-xs">{stat.lastError}</span>
                      )}
                    </div>
                  )}
                  {result && (
                    <div className={`mt-2 text-[11px] rounded-lg px-2.5 py-1.5 inline-block ${
                      result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {result.ok
                        ? count > 0 ? `✓ ${count} email(s) processed` : '✓ No new emails'
                        : `Error: ${result.error}`}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handlePollNow(key)}
                  disabled={polling[key]}
                  className="shrink-0 flex items-center gap-1.5 text-[12px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={12} className={polling[key] ? 'animate-spin' : ''} />
                  {polling[key] ? 'Running…' : 'Run now'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
