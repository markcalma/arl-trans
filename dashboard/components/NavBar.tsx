'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavBar() {
  const pathname = usePathname()

  if (pathname === '/login') return null

  const links = [
    { href: '/', label: 'WF1 · Water Report' },
    { href: '/wf-do', label: 'WF-DO · DO Redaction' },
  ]

  return (
    <nav className="bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">ARL-Trans</span>
        <div className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors pb-0.5 ${
                pathname === link.href
                  ? 'text-gray-900 border-b border-gray-900'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
