import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getDOOrder } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const safeId = id.replace(/[^A-Z0-9a-z\-_]/g, '')
  const order = getDOOrder(safeId)
  const filePath = order?.pdfPath ?? path.join(process.cwd(), 'data', 'pdfs', `${safeId}.pdf`)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const pdfBytes = fs.readFileSync(filePath)
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeId}-redacted.pdf"`,
    },
  })
}
