import { WFDOOrder } from '@/lib/types'

export function WFDOSentTable({ orders }: { orders: WFDOOrder[] }) {
  const sent = orders.filter((o) => o.status === 'sent')
  if (sent.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Sent Today ({sent.length})
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Container</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Consignee</th>
            <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Carrier Email</th>
            <th className="pb-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Sent At</th>
          </tr>
        </thead>
        <tbody>
          {sent.map((o) => (
            <tr key={o.id} className="border-t border-gray-100">
              <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{o.containerNumber}</td>
              <td className="py-3 pr-6 text-gray-500">{o.consignee}</td>
              <td className="py-3 pr-6 text-gray-500 text-xs">{o.carrierEmail || '—'}</td>
              <td className="py-3 text-gray-400 text-xs">
                {o.sentAt ? new Date(o.sentAt).toLocaleTimeString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
