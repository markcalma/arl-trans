'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Truck } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    setLoading(false)

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Truck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-foreground">ARL-Trans</h1>
            <p className="text-xs text-muted">Operations Dashboard</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 placeholder:text-gray-300 transition-colors"
              placeholder="Enter password"
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-blue-600 text-white text-sm font-medium rounded-lg py-2.5 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
