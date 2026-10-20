import { getLatestRun, getHandled, getLFDEntries, getEmailStatus } from '@/lib/storage'
import { RunStatusBar } from '@/components/RunStatusBar'
import { LFDInputPanel } from '@/components/LFDInputPanel'
import { SendEmailsButton } from '@/components/SendEmailsButton'
import { PerDiemAlerts } from '@/components/PerDiemAlerts'
import { ExceptionQueue } from '@/components/ExceptionQueue'
import { LogoutButton } from '@/components/LogoutButton'
import { AutoRefresh } from '@/components/AutoRefresh'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const run = getLatestRun()
  const handled = getHandled()
  const lfdEntries = getLFDEntries()
  const emailStatus = getEmailStatus()

  const containers = run?.containers ?? []
  const savedNumbers = new Set(lfdEntries.map((e) => e.containerNumber))
  const pendingCount = containers.filter((c) => !c.lfd && !savedNumbers.has(c.containerNumber)).length
  const savedCount = lfdEntries.length

  return (
    <main className="min-h-screen bg-gray-50">
      <AutoRefresh />
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-5">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ARL-Trans · Operations Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">WF1 — Water Report automation</p>
          </div>
          <LogoutButton />
        </div>

        <RunStatusBar run={run} />
        <PerDiemAlerts alerts={run?.perDiemAlerts ?? []} />
        <LFDInputPanel containers={containers} savedEntries={lfdEntries} />
        <ExceptionQueue exceptions={run?.exceptions ?? []} handled={handled} />
        <SendEmailsButton pendingCount={pendingCount} savedCount={savedCount} emailSentAt={emailStatus.sentAt} />
      </div>
    </main>
  )
}
