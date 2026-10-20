import { NextRequest, NextResponse } from 'next/server'
import { appendDOOrder } from '@/lib/storage'
import { WFDOOrder } from '@/lib/types'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  let body: { secret?: string; date?: string; order?: WFDOOrder; pdfBase64?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (body.secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!body.date || !body.order?.id) {
    return NextResponse.json({ error: 'Missing date or order.id' }, { status: 400 })
  }

  if (body.pdfBase64) {
    const pdfDir = path.join(process.cwd(), 'data', 'pdfs')
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true })
    const pdfBuffer = Buffer.from(body.pdfBase64, 'base64')
    fs.writeFileSync(path.join(pdfDir, `${body.order.id}.pdf`), pdfBuffer)
  }

  appendDOOrder(body.date, body.order as WFDOOrder)
  return NextResponse.json({ ok: true })
}
