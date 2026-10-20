import { NextRequest, NextResponse } from 'next/server'
import { getDOOrder, updateDOOrder } from '@/lib/db'
import { sendEmail } from '@/lib/gmail'
import { appendToLoadBoard, appendToMasterList } from '@/lib/sheets'
import path from 'path'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const orderId = decodeURIComponent(id)
  const order = getDOOrder(orderId)

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 409 })

  const body = await req.json().catch(() => ({}))

  const sentAt = new Date().toISOString()
  const updatedOrder = {
    ...order,
    status: 'sent' as const,
    sentAt,
    carrierEmail: body.carrierEmail ?? order.carrierEmail,
    carrierNotes: body.carrierNotes ?? order.carrierNotes,
    containerNumber: body.containerNumber ?? order.containerNumber,
    masterBL: body.masterBL ?? order.masterBL,
    arrivalDate: body.arrivalDate ?? order.arrivalDate,
    consignee: body.consignee ?? order.consignee,
    consigneeAddress: body.consigneeAddress ?? order.consigneeAddress,
    cargoDescription: body.cargoDescription ?? order.cargoDescription,
    packages: body.packages ?? order.packages,
    weightKg: body.weightKg ?? order.weightKg,
    portLocation: body.portLocation ?? order.portLocation,
  }

  updateDOOrder(orderId, updatedOrder)

  const errors: string[] = []

  if (order.pdfPath && updatedOrder.carrierEmail) {
    const pdfFilename = `DO-${updatedOrder.containerNumber || orderId}.pdf`
    const emailBody = [
      `Please find attached the Delivery Order for container ${updatedOrder.containerNumber}.`,
      '',
      updatedOrder.carrierNotes || '',
      '',
      'ARL-Trans',
    ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n')

    try {
      await sendEmail({
        to: updatedOrder.carrierEmail,
        subject: `Delivery Order — ${updatedOrder.containerNumber}`,
        body: emailBody,
        attachmentPath: path.resolve(order.pdfPath),
        attachmentName: pdfFilename,
      })
    } catch (err) {
      console.error('[wfdo-approve] Email send failed:', err)
      errors.push('email_send_failed')
    }
  }

  try {
    await appendToLoadBoard(updatedOrder)
  } catch (err) {
    console.error('[wfdo-approve] Load Board write failed:', err)
    errors.push('load_board_failed')
  }

  try {
    await appendToMasterList(updatedOrder)
  } catch (err) {
    console.error('[wfdo-approve] Master List write failed:', err)
    errors.push('master_list_failed')
  }

  return NextResponse.json({ ok: true, errors: errors.length > 0 ? errors : undefined })
}
