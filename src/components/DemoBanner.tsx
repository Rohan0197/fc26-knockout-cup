import { FlaskConical } from 'lucide-react'
import { useTournament } from '../context/TournamentContext'

/** Shown only when running on the local sample-data backend (development). Never in production. */
export function DemoBanner() {
  const { mode } = useTournament()
  if (mode !== 'demo') return null
  return (
    <div
      className="label pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[65] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap bg-warn px-3 py-1.5 text-[0.68rem] tracking-[0.16em] text-ink-950 shadow-lg"
      role="note"
      title="Sample data stored in this browser only. Connect Supabase for the real tournament."
    >
      <FlaskConical size={12} className="shrink-0" />
      Dev demo · sample data
    </div>
  )
}
