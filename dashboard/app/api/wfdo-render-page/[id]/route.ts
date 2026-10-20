import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const safeId = id.replace(/[^A-Z0-9a-z\-_]/g, '')

  const serviceUrl = process.env.REDACT_SERVICE_URL
  if (!serviceUrl) {
    return NextResponse.json({ error: 'Redact service not configured' }, { status: 503 })
  }

  const filePath = path.join(process.cwd(), 'data', 'pdfs', `${safeId}.pdf`)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const pdfBytes = fs.readFileSync(filePath)
  const formData = new FormData()
  formData.append('pdf', new Blob([pdfBytes], { type: 'application/pdf' }), `${safeId}.pdf`)

  const res = await fetch(`${serviceUrl}/render-page`, { method: 'POST', body: formData })
  if (!res.ok) {
    return NextResponse.json({ error: 'Render failed' }, { status: 502 })
  }

  const pngBytes = await res.arrayBuffer()
  return new NextResponse(pngBytes, { headers: { 'Content-Type': 'image/png' } })
}
