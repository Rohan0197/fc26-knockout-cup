import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, GitBranch } from 'lucide-react'
import type { Match, Player, Round } from '../types'
import { ROUND_LABEL } from '../lib/bracket'
import { useMatches } from '../hooks/useMatches'
import { fmtKickoff, pad2 } from '../utils/format'
import { MatchCard } from './MatchCard'
import { EmptyState } from './ui/EmptyState'
import { PlayerAvatar } from './ui/PlayerAvatar'
import { BracketSkeleton } from './ui/Skeletons'

const BOX_W = 212
const GAP = 44
const SLOT_H = 120
const HEADER_H = 52
const CHAMP_W = 196

/* ------------------------------------------------------------------ one match in the tree */

function Row({ player, score, winner, loser }: { player: Player | null; score: number | null; winner: boolean; loser: boolean }) {
  return (
    <div className={`relative flex h-[34px] items-center gap-2 px-2.5 ${winner ? 'bg-pitch/[0.12]' : ''}`}>
      {winner && <span className="absolute inset-y-0 left-0 w-[3px] bg-pitch shadow-[0_0_10px_rgba(43,255,136,0.8)]" />}
      {player ? (
        <PlayerAvatar player={player} size={22} className={loser ? 'opacity-45 grayscale' : ''} />
      ) : (
        <span className="h-[22px] w-[22px] shrink-0 border border-dashed border-white/15" />
      )}
      <span
        className={`display min-w-0 flex-1 truncate text-[1.18rem] leading-none ${
          !player ? 'text-mute/60' : loser ? 'text-soft/55' : 'text-white'
        }`}
      >
        {player ? player.name : 'TBD'}
      </span>
      {score !== null && (
        <span className={`num grid h-6 min-w-6 place-items-center px-1.5 text-lg leading-none ${winner ? 'bg-pitch text-ink-950' : 'text-soft'}`}>
          {score}
        </span>
      )}
    </div>
  )
}

const BracketMatch = memo(function BracketMatch({ match, byId }: { match: Match; byId: Map<string, Player> }) {
  const p1 = match.player1_id ? (byId.get(match.player1_id) ?? null) : null
  const p2 = match.player2_id ? (byId.get(match.player2_id) ?? null) : null
  const done = match.status === 'COMPLETED'
  return (
    <div
      className={`panel relative w-full overflow-hidden !bg-ink-900/85 ${match.status === 'CANCELLED' ? 'opacity-50' : ''}`}
      style={{ ['--cut' as string]: '10px' }}
    >
      <div className="label flex h-[22px] items-center justify-between border-b border-white/[0.06] pl-2.5 pr-4 text-[0.62rem] text-mute">
        <span>M{pad2(match.match_number)}</span>
        {match.status === 'LIVE' ? (
          <span className="flex items-center gap-1.5 text-pitch">
            <span className="live-dot !h-1.5 !w-1.5" /> Live
          </span>
        ) : done ? (
          <span className="text-soft">FT</span>
        ) : match.status === 'CANCELLED' ? (
          <span className="text-danger">Cancelled</span>
        ) : (
          <span>{match.scheduled_at ? fmtKickoff(match.scheduled_at) : 'TBC'}</span>
        )}
      </div>
      <Row player={p1} score={done ? match.player1_score : null} winner={done && match.winner_id === match.player1_id} loser={done && match.winner_id !== match.player1_id} />
      <div className="h-px bg-white/[0.06]" />
      <Row player={p2} score={done ? match.player2_score : null} winner={done && match.winner_id === match.player2_id} loser={done && match.winner_id !== match.player2_id} />
    </div>
  )
})

/* ------------------------------------------------------------------ connector lines */

function Line({ lit, style, axis, origin, delay }: { lit: boolean; style: React.CSSProperties; axis: 'x' | 'y'; origin: string; delay: number }) {
  return (
    <motion.span
      aria-hidden
      className={`absolute ${axis === 'x' ? 'h-px' : 'w-px'} ${lit ? 'bg-pitch shadow-[0_0_8px_rgba(43,255,136,0.7)]' : 'bg-white/[0.16]'}`}
      style={{ ...style, transformOrigin: origin }}
      initial={axis === 'x' ? { scaleX: 0 } : { scaleY: 0 }}
      animate={axis === 'x' ? { scaleX: 1 } : { scaleY: 1 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
    />
  )
}

function Slot({ match, byId, outWidth, lit, delay }: { match: Match; byId: Map<string, Player>; outWidth: number | null; lit: boolean; delay: number }) {
  return (
    <div className="relative flex flex-1 items-center" style={{ minHeight: SLOT_H }}>
      <BracketMatch match={match} byId={byId} />
      {outWidth !== null && (
        <Line lit={lit} axis="x" origin="left" delay={delay} style={{ left: '100%', top: '50%', width: outWidth }} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ the tree */

function Tree({ rounds, byId, currentRound }: { rounds: { round: Round; matches: Match[] }[]; byId: Map<string, Player>; currentRound: Round | null }) {
  const bodyH = Math.max(...rounds.map((r) => r.matches.length)) * SLOT_H
  const last = rounds[rounds.length - 1]
  const finalDone = last.round === 'FINAL' && last.matches[0]?.status === 'COMPLETED'
  const champion = finalDone ? (byId.get(last.matches[0].winner_id ?? '') ?? null) : null
  const showChampion = last.round === 'FINAL'

  return (
    <div className="flex" style={{ gap: GAP }}>
      {rounds.map((r, ci) => {
        const hasNext = ci < rounds.length - 1
        const isLast = !hasNext
        const delay = 0.25 + ci * 0.2
        const played = r.matches.filter((m) => m.status === 'COMPLETED').length
        const isCurrent = r.round === currentRound
        const pairs: Match[][] = []
        if (hasNext && r.matches.length % 2 === 0) {
          for (let i = 0; i < r.matches.length; i += 2) pairs.push([r.matches[i], r.matches[i + 1]])
        }

        return (
          <div key={r.round} className="flex shrink-0 flex-col" style={{ width: BOX_W }}>
            <div className="flex flex-col justify-center" style={{ height: HEADER_H }}>
              <div className="flex items-center gap-2">
                <span className={`display text-[1.55rem] ${isCurrent ? 'text-white' : 'text-soft'}`}>{ROUND_LABEL[r.round]}</span>
                {isCurrent && <span className="live-dot" title="Current round" />}
              </div>
              <div className="label text-[0.66rem] text-mute">
                {played}/{r.matches.length} played
              </div>
            </div>

            <div className="flex flex-col" style={{ height: bodyH }}>
              {pairs.length > 0
                ? pairs.map(([a, b]) => (
                    <div key={a.id} className="relative flex flex-1 flex-col">
                      <Slot match={a} byId={byId} outWidth={GAP / 2} lit={a.status === 'COMPLETED'} delay={delay} />
                      <Slot match={b} byId={byId} outWidth={GAP / 2} lit={b.status === 'COMPLETED'} delay={delay} />
                      <Line axis="y" origin="top" lit={a.status === 'COMPLETED'} delay={delay + 0.2} style={{ left: `calc(100% + ${GAP / 2}px)`, top: '25%', height: '25%' }} />
                      <Line axis="y" origin="bottom" lit={b.status === 'COMPLETED'} delay={delay + 0.2} style={{ left: `calc(100% + ${GAP / 2}px)`, top: '50%', height: '25%' }} />
                      <Line axis="x" origin="left" lit={a.status === 'COMPLETED' && b.status === 'COMPLETED'} delay={delay + 0.4} style={{ left: `calc(100% + ${GAP / 2}px)`, top: '50%', width: GAP / 2 }} />
                    </div>
                  ))
                : r.matches.map((m) => (
                    <Slot
                      key={m.id}
                      match={m}
                      byId={byId}
                      outWidth={isLast && showChampion ? GAP : null}
                      lit={m.status === 'COMPLETED'}
                      delay={delay}
                    />
                  ))}
            </div>
          </div>
        )
      })}

      {showChampion && (
        <div className="flex shrink-0 flex-col" style={{ width: CHAMP_W }}>
          <div className="flex flex-col justify-center" style={{ height: HEADER_H }}>
            <span className="display text-[1.55rem] text-gold">Champion</span>
          </div>
          <div className="flex items-center" style={{ height: bodyH }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + rounds.length * 0.2, duration: 0.5 }}
              className={`panel panel-both w-full p-4 text-center ${champion ? '!border-gold/50' : ''}`}
              style={champion ? { background: 'linear-gradient(180deg, rgba(230,195,106,0.16), rgba(10,13,18,0.85))' } : undefined}
            >
              <Crown size={22} className={`mx-auto ${champion ? 'text-gold' : 'text-mute/50'}`} />
              {champion ? (
                <>
                  <div className="mx-auto mt-3 w-fit"><PlayerAvatar player={champion} size={56} /></div>
                  <div className="display mt-3 text-2xl text-white">{champion.name}</div>
                  <div className="label mt-1 text-[0.66rem] text-gold">Tournament winner</div>
                </>
              ) : (
                <>
                  <div className="display mt-3 text-2xl text-mute/70">TBD</div>
                  <div className="label mt-1 text-[0.66rem] text-mute">To be decided</div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ public component */

export function KnockoutBracket() {
  const { matches, rounds, byId, tournament, loading } = useMatches()
  const roundKeys = rounds.map((r) => r.round).join()
  const defaultRound = tournament.currentRound ?? rounds[0]?.round ?? null
  const [mobileRound, setMobileRound] = useState<Round | null>(defaultRound)

  // Keep the mobile round selection valid as fixtures change.
  useEffect(() => {
    setMobileRound((cur) => (cur && roundKeys.split(',').includes(cur) ? cur : defaultRound))
  }, [roundKeys, defaultRound])

  const scroller = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 8)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [roundKeys, loading, matches.length])

  const activeMobile = useMemo(() => rounds.find((r) => r.round === mobileRound) ?? rounds[0], [rounds, mobileRound])

  if (loading) return <BracketSkeleton />

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={<GitBranch size={26} />}
        title="Bracket pending"
        message="The knockout bracket will appear here as soon as the fixtures are confirmed."
      />
    )
  }

  return (
    <>
      {/* tablet / desktop: the full bracket tree */}
      {overflowing && (
        <div className="label mb-2 hidden items-center justify-end gap-2 text-[0.72rem] text-mute md:flex">
          Scroll sideways to see every round <span aria-hidden>→</span>
        </div>
      )}
      <div ref={scroller} className="panel hidden overflow-x-auto overscroll-x-contain p-6 md:block">
        <div className="mx-auto w-max">
          <Tree rounds={rounds} byId={byId} currentRound={tournament.currentRound} />
        </div>
      </div>

      {/* mobile: round-by-round vertical bracket */}
      <div className="md:hidden">
        <div className="hide-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Bracket rounds">
          {rounds.map((r) => (
            <button
              key={r.round}
              role="tab"
              aria-selected={activeMobile?.round === r.round}
              onClick={() => setMobileRound(r.round)}
              className={`label shrink-0 px-4 py-3 text-[0.85rem] ring-1 ring-inset transition-colors ${
                activeMobile?.round === r.round ? 'bg-pitch text-ink-950 ring-pitch' : 'bg-white/[0.04] text-soft ring-white/12'
              }`}
            >
              {ROUND_LABEL[r.round]}
            </button>
          ))}
        </div>
        <div className="space-y-4" key={activeMobile?.round}>
          {activeMobile?.matches.map((m, i) => (
            <MatchCard key={m.id} match={m} byId={byId} index={i} />
          ))}
        </div>
      </div>
    </>
  )
}
