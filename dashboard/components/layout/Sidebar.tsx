'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FileSpreadsheet, FileText, LogOut, Settings, Truck } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Water Report', sublabel: 'WF1', icon: FileSpreadsheet },
  { href: '/wf-do', label: 'DO Redaction', sublabel: 'WF-DO', icon: FileText },
]

const systemItems = [
  { href: '/admin', label: 'Admin', sublabel: '', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

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
            {navItems.map(({ href, label, sublabel, icon: Icon }) => {
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

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-gray-800">
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
