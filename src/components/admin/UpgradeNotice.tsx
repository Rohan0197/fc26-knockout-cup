import { DatabaseZap } from 'lucide-react'
import { useTournament } from '../../context/TournamentContext'

/**
 * Shown to admins while the database has not had the one-time upgrade (migration 003). The site works exactly as before; only
 * the new features (extra matches, choosing who advances, brackets for any number of players) wait for it.
 */
export function UpgradeNotice({ feature, compact }: { feature?: string; compact?: boolean }) {
  const { schemaReady } = useTournament()
  if (schemaReady) return null
  return (
    <div role="note" className={`flex items-start gap-3 border-l-2 border-warn bg-warn/[0.08] px-4 py-3 text-sm text-soft ${compact ? '' : 'mb-6'}`}>
      <DatabaseZap size={18} className="mt-0.5 shrink-0 text-warn" />
      <div>
        <strong className="text-white">{feature ?? 'New features'} will switch on after a one-time database upgrade.</strong>{' '}
        Everything you use today keeps working in the meantime. The upgrade is <code className="text-soft">supabase/migrations/003_extra_matches_manual_advance.sql</code>{' '}
        (run it once in the Supabase SQL Editor; it does not change any existing data).
      </div>
    </div>
  )
}
