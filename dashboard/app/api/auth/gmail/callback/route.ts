import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/gmail'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')
  const base = req.nextUrl.origin

  if (error) {
    return NextResponse.redirect(`${base}/admin?error=${encodeURIComponent(error)}`)
  }
  if (!code) {
    return NextResponse.redirect(`${base}/admin?error=no_code`)
  }

  try {
    await exchangeCode(code)
    return NextResponse.redirect(`${base}/admin?connected=true`)
  } catch (err) {
    return NextResponse.redirect(`${base}/admin?error=${encodeURIComponent(String(err))}`)
  }
}
