import { PerDiemAlert } from '@/lib/types'

function urgencyPill(days: number): string {
  if (days <= 1) return 'bg-red-50 text-red-700'
  if (days <= 3) return 'bg-orange-50 text-orange-700'
  return 'bg-amber-50 text-amber-700'
}

const INVALID_CONTAINERS = new Set(['127', '9655', '9665', '9668', '932963'])

export function PerDiemAlerts({ alerts }: { alerts: PerDiemAlert[] }) {
  alerts = alerts.filter((a) => !INVALID_CONTAINERS.has(a.containerNumber))
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Per Diem Alerts ({alerts.length})
      </h2>
      {alerts.length === 0 ? (
        <p className="text-gray-400 text-sm">No per diem alerts today</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Container</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">Location</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">SSL</th>
              <th className="pb-3 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wide">LFD</th>
              <th className="pb-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Days</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.containerNumber} className="border-t border-gray-100">
                <td className="py-3 pr-6 text-gray-900 font-mono text-xs font-medium">{a.containerNumber}</td>
                <td className="py-3 pr-6 text-gray-500">{a.location}</td>
                <td className="py-3 pr-6 text-gray-500">{a.ssl}</td>
                <td className="py-3 pr-6 text-gray-500">{a.lfd}</td>
                <td className="py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${urgencyPill(a.daysRemaining)}`}>
                    {a.daysRemaining} {a.daysRemaining === 1 ? 'day' : 'days'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
