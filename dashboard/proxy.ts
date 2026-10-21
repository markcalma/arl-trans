import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'arl-session'
const PUBLIC = ['/login', '/api/auth/', '/api/health', '/api/wf1-webhook', '/api/wf2-webhook', '/api/wf3-webhook', '/api/wfdo-webhook', '/api/lfd-manual', '/api/email-sent']

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const expected = await sha256hex(process.env.DASHBOARD_PASSWORD ?? '')
  if (req.cookies.get(COOKIE)?.value !== expected) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
