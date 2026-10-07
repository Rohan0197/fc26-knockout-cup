import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, ClipboardList } from 'lucide-react'
import type { Match } from '../types'
import { groupByRound, ROUND_LABEL } from '../lib/bracket'
import { useMatches } from '../hooks/useMatches'
import { MatchCard } from './MatchCard'
import { EmptyState } from './ui/EmptyState'
import { MatchCardsSkeleton } from './ui/Skeletons'

type Tab = 'ALL' | 'UPCOMING' | 'COMPLETED'
const TABS: Tab[] = ['ALL', 'UPCOMING', 'COMPLETED']

const matchesTab = (m: Match, tab: Tab) =>
  tab === 'ALL' ||
  (tab === 'UPCOMING' && (m.status === 'UPCOMING' || m.status === 'LIVE')) ||
  (tab === 'COMPLETED' && m.status === 'COMPLETED')

export function FixtureList() {
  const { matches, byId, loading } = useMatches()
  const [tab, setTab] = useState<Tab>('ALL')

  const counts = useMemo(
    () => ({
      ALL: matches.length,
      UPCOMING: matches.filter((m) => matchesTab(m, 'UPCOMING')).length,
      COMPLETED: matches.filter((m) => matchesTab(m, 'COMPLETED')).length,
    }),
    [matches],
  )
  const groups = useMemo(() => groupByRound(matches.filter((m) => matchesTab(m, tab))), [matches, tab])

  if (loading) return <MatchCardsSkeleton count={6} />

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock size={26} />}
        title="Fixtures pending"
        message="Final tournament fixtures will appear here once the bracket is confirmed."
      />
    )
  }

  return (
    <div>
      <div role="tablist" aria-label="Fixture filter" className="hide-scrollbar mb-8 flex gap-1 overflow-x-auto border-b border-white/[0.08]">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="relative shrink-0 px-4 py-3 sm:px-6"
          >
            <span className={`label text-[0.95rem] transition-colors ${tab === t ? 'text-white' : 'text-mute hover:text-white'}`}>
              {t}
              <span className="num ml-2 text-[0.85rem] text-mute">{counts[t]}</span>
            </span>
            {tab === t && (
              <motion.span
                layoutId="fixture-tab"
                className="absolute inset-x-0 -bottom-px h-[3px] bg-pitch shadow-[0_0_14px_rgba(43,255,136,0.7)]"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        tab === 'COMPLETED' ? (
          <EmptyState
            compact
            icon={<ClipboardList size={26} />}
            title="No results yet"
            message="Match results will appear here once the tournament begins."
          />
        ) : (
          <EmptyState
            compact
            icon={<CalendarClock size={26} />}
            title="No upcoming matches"
            message="Every scheduled match has been played."
          />
        )
      ) : (
        <div className="space-y-12" key={tab}>
          {groups.map((g) => {
            const played = g.matches.filter((m) => m.status === 'COMPLETED').length
            return (
              <section key={g.round} aria-label={ROUND_LABEL[g.round]}>
                <div className="relative mb-5 flex items-center gap-4">
                  <span className="relative grid h-4 w-4 place-items-center">
                    <span className="absolute h-4 w-4 rotate-45 border border-pitch/70" />
                    <span className="h-1.5 w-1.5 rotate-45 bg-pitch" />
                  </span>
                  <h2 className="display text-3xl text-white sm:text-4xl">{ROUND_LABEL[g.round]}</h2>
                  <span className="label text-[0.78rem] text-mute">
                    {played}/{g.matches.length} played
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                </div>
                <div className="ml-2 grid gap-4 border-l border-white/[0.08] pl-5 sm:ml-[7px] sm:pl-8 md:grid-cols-2">
                  {g.matches.map((m, i) => (
                    <MatchCard key={m.id} match={m} byId={byId} index={i} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
