'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FileSpreadsheet, FileText, LogOut, Settings, Truck } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Water Report', sublabel: 'WF1', icon: FileSpreadsheet, countKey: 'wf1Count' as const },
  { href: '/wf-do', label: 'DO Redaction', sublabel: 'WF-DO', icon: FileText, countKey: 'doCount' as const },
]

const systemItems = [
  { href: '/admin', label: 'Admin', sublabel: '', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [counts, setCounts] = useState<{ doCount: number; wf1Count: number } | null>(null)
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null)

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch('/api/pending-counts')
        if (res.ok) setCounts(await res.json())
      } catch { /* ignore */ }
    }
    async function fetchGmail() {
      try {
        const res = await fetch('/api/auth/gmail/status')
        if (res.ok) {
          const data = await res.json()
          setGmailConnected(data.connected)
        }
      } catch { /* ignore */ }
    }

    fetchCounts()
    fetchGmail()
    const countsId = setInterval(fetchCounts, 30_000)
    const gmailId = setInterval(fetchGmail, 60_000)
    return () => { clearInterval(countsId); clearInterval(gmailId) }
  }, [])

  if (pathname === '/login') return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 min-h-screen bg-gray-950 border-r border-gray-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <Truck size={16} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-100">ARL-Trans</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-3 mb-2">
            Operations
          </p>
          <div className="space-y-0.5">
            {navItems.map(({ href, label, sublabel, icon: Icon, countKey }) => {
              const active = pathname === href
              const count = counts?.[countKey] ?? 0
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                  }`}
                >
                  <div className="relative shrink-0">
                    <Icon size={15} />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </div>
                  <span>{label}</span>
                  <span className={`ml-auto font-mono text-[10px] ${active ? 'text-blue-200' : 'text-gray-600'}`}>
                    {sublabel}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-3 mb-2">
            System
          </p>
          <div className="space-y-0.5">
            {systemItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Footer: Gmail status + Sign out */}
      <div className="px-2 py-3 border-t border-gray-800 space-y-1">
        {gmailConnected !== null && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${gmailConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {gmailConnected ? (
              <span className="text-[11px] text-gray-500">Gmail connected</span>
            ) : (
              <Link href="/admin" className="text-[11px] text-red-400 hover:text-red-300 transition-colors">
                Gmail disconnected
              </Link>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors"
        >
          <LogOut size={15} className="shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
