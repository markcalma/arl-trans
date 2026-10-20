import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'

const COOKIE = 'arl-session'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const expected = process.env.DASHBOARD_PASSWORD ?? ''

  const a = Buffer.from(password ?? '')
  const b = Buffer.from(expected)

  const match = a.length === b.length && timingSafeEqual(a, b)

  if (!match) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const token = createHash('sha256').update(expected).digest('hex')
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
