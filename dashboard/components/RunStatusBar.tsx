import { WF1Run } from '@/lib/types'

const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
}

const STATUS_PILL: Record<string, string> = {
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
}

export function RunStatusBar({ run }: { run: WF1Run | null }) {
  if (!run || !run.summary) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        <span className="text-gray-400 text-sm">No runs recorded yet</span>
      </div>
    )
  }

  const date = new Date(run.runAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[run.status]}`} />
        <span className="text-sm font-semibold text-gray-900">Last run: {date}</span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[run.status]}`}>
          {STATUS_LABEL[run.status]}
        </span>
      </div>
      <div className="flex gap-5 text-xs text-gray-400">
        <span><span className="text-gray-900 font-semibold">{run.summary.total}</span> processed</span>
        <span><span className="text-green-700 font-semibold">{run.summary.added}</span> added</span>
        <span><span className="text-blue-700 font-semibold">{run.summary.updated}</span> updated</span>
        <span><span className="text-gray-400 font-semibold">{run.summary.skipped}</span> skipped</span>
      </div>
    </div>
  )
}
