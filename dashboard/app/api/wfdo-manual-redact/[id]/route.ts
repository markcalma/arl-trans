import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getDOOrder } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const safeId = id.replace(/[^A-Z0-9a-z\-_]/g, '')

  const serviceUrl = process.env.REDACT_SERVICE_URL
  if (!serviceUrl) {
    return NextResponse.json({ error: 'Redact service not configured' }, { status: 503 })
  }

  const order = getDOOrder(safeId)
  const filePath = order?.pdfPath ?? path.join(process.cwd(), 'data', 'pdfs', `${safeId}.pdf`)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const boxes = Array.isArray(body.boxes) ? body.boxes : []

  const pdfBytes = fs.readFileSync(filePath)
  const formData = new FormData()
  formData.append('pdf', new Blob([pdfBytes], { type: 'application/pdf' }), `${safeId}.pdf`)
  formData.append('boxes', JSON.stringify(boxes))

  const res = await fetch(`${serviceUrl}/manual-redact`, { method: 'POST', body: formData })
  if (!res.ok) {
    return NextResponse.json({ error: 'Manual redact failed' }, { status: 502 })
  }

  const resultBytes = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(filePath, resultBytes)

  return NextResponse.json({ ok: true })
}
