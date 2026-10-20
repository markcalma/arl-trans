'use client'

import { useState } from 'react'

export function SendEmailsButton({
  pendingCount,
  savedCount,
  emailSentAt,
}: {
  pendingCount: number
  savedCount: number
  emailSentAt: string | null
}) {
  const [sending, setSending] = useState(false)
  const [lastSentAt, setLastSentAt] = useState<string | null>(emailSentAt)

  async function handleSend() {
    setSending(true)
    try {
      await fetch('/api/trigger-stage3', { method: 'POST' })
      const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      setLastSentAt(now)
    } finally {
      setSending(false)
    }
  }

  function statusLine() {
    if (lastSentAt) return { text: `Sent at ${lastSentAt} ✓`, color: 'text-green-600' }
    if (savedCount === 0) return { text: 'Enter LFDs above before sending', color: 'text-gray-400' }
    if (pendingCount > 0) return { text: `${savedCount} ready · ${pendingCount} still pending`, color: 'text-amber-600' }
    return { text: `All ${savedCount} LFDs ready`, color: 'text-green-600' }
  }

  const { text, color } = statusLine()

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Send daily emails</p>
        <p className={`text-xs mt-0.5 ${color}`}>{text}</p>
      </div>
      <button
        onClick={handleSend}
        disabled={sending || savedCount === 0}
        className="text-sm font-medium text-white bg-blue-600 rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {sending ? 'Sending…' : 'Send Emails'}
      </button>
    </div>
  )
}
