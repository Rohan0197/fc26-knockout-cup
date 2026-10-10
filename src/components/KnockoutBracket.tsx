import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, GitBranch, LayoutList } from 'lucide-react'
import type { Match, Player, Round } from '../types'
import { ROUND_LABEL, resolveNext } from '../lib/bracket'
import { useMatches } from '../hooks/useMatches'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { fmtKickoff, pad2 } from '../utils/format'
import { MatchCard } from './MatchCard'
import { EmptyState } from './ui/EmptyState'
import { PlayerAvatar } from './ui/PlayerAvatar'
import { BracketSkeleton } from './ui/Skeletons'

const BOX_W = 212
const GAP = 44
/** Vertical room per first-round match. Tighter for big brackets so a 64-player tree stays manageable. */
const slotHeightFor = (firstRoundMatches: number) => (firstRoundMatches > 8 ? 104 : 120)
const HEADER_H = 52
const BOX_H = 93 // 22 header + 2 x 34 rows + divider + border
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

/* ------------------------------------------------------------------ the tree */

interface TreeLayout {
  pos: Map<string, { col: number; y: number }>
  links: { from: Match; to: Match; col1: number; col2: number; y1: number; y2: number }[]
  bodyH: number
  byes: number[]
  finalY: number | null
}

/**
 * Positions every match from the matches that feed it (a match sits at the average height of its feeders), so
 * rounds with an odd number of matches and byes that skip a round lay out correctly. First-round matches are
 * simply stacked evenly.
 */
function layoutTree(rounds: { round: Round; matches: Match[] }[], all: Match[], slotH: number): TreeLayout {
  const inTree = new Set(rounds.flatMap((r) => r.matches.map((m) => m.id)))
  const colOf = new Map<string, number>()
  rounds.forEach((r, ci) => r.matches.forEach((m) => colOf.set(m.id, ci)))

  const feeders = new Map<string, Match[]>()
  const links: TreeLayout['links'] = []
  const resolved: { from: Match; to: Match }[] = []
  for (const r of rounds)
    for (const m of r.matches) {
      const nx = resolveNext(m, all)
      if (nx?.match && inTree.has(nx.match.id)) {
        resolved.push({ from: m, to: nx.match })
        feeders.set(nx.match.id, [...(feeders.get(nx.match.id) ?? []), m])
      }
    }

  const pos = new Map<string, { col: number; y: number }>()
  const minGap = BOX_H + 14
  rounds.forEach((r, ci) => {
    let free = 0
    const ys = r.matches.map((m) => {
      const fs = (feeders.get(m.id) ?? []).filter((f) => pos.has(f.id))
      if (fs.length > 0) return fs.reduce((sum, f) => sum + pos.get(f.id)!.y, 0) / fs.length
      return free++ * slotH + slotH / 2
    })
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + minGap) ys[i] = ys[i - 1] + minGap
    r.matches.forEach((m, i) => pos.set(m.id, { col: ci, y: ys[i] }))
  })

  let bodyH = 0
  pos.forEach((p) => (bodyH = Math.max(bodyH, p.y + BOX_H / 2 + 12)))

  const byes = rounds.map(() => 0)
  for (const { from, to } of resolved) {
    const c1 = colOf.get(from.id)!
    const c2 = colOf.get(to.id)!
    for (let c = c1 + 1; c < c2; c++) byes[c]++
    links.push({ from, to, col1: c1, col2: c2, y1: pos.get(from.id)!.y, y2: pos.get(to.id)!.y })
  }
  const last = rounds[rounds.length - 1]
  const fin = last.round === 'FINAL' ? last.matches[0] : undefined
  return { pos, links, bodyH, byes, finalY: fin ? pos.get(fin.id)!.y : null }
}

function Tree({
  rounds,
  all,
  byId,
  currentRound,
}: {
  rounds: { round: Round; matches: Match[] }[]
  all: Match[]
  byId: Map<string, Player>
  currentRound: Round | null
}) {
  const slotH = slotHeightFor(Math.max(...rounds.map((r) => r.matches.length)))
  const layout = useMemo(() => layoutTree(rounds, all, slotH), [rounds, all, slotH])
  const colX = (c: number) => c * (BOX_W + GAP)
  const last = rounds[rounds.length - 1]
  const showChampion = last.round === 'FINAL'
  const finalMatch = showChampion ? last.matches[0] : undefined
  const champion = finalMatch?.status === 'COMPLETED' ? (byId.get(finalMatch.winner_id ?? '') ?? null) : null
  const totalW = colX(rounds.length) + (showChampion ? CHAMP_W : -GAP)

  const pathFor = (l: TreeLayout['links'][number]) => {
    const x1 = colX(l.col1) + BOX_W
    const x2 = colX(l.col2)
    const xm = x2 - GAP / 2 // vertical run sits in the gap just before the target column
    return `M ${x1} ${l.y1} H ${xm} V ${l.y2} H ${x2}`
  }
  const dim = layout.links.filter((l) => l.from.status !== 'COMPLETED')
  const lit = layout.links.filter((l) => l.from.status === 'COMPLETED')
  const finalLink =
    showChampion && layout.finalY !== null ? `M ${colX(rounds.length - 1) + BOX_W} ${layout.finalY} H ${colX(rounds.length)}` : null

  return (
    <div className="relative" style={{ width: totalW, height: HEADER_H + layout.bodyH }}>
      {rounds.map((r, ci) => {
        const played = r.matches.filter((m) => m.status === 'COMPLETED').length
        const isCurrent = r.round === currentRound
        return (
          <div key={r.round} className="absolute flex flex-col justify-center" style={{ left: colX(ci), top: 0, width: BOX_W, height: HEADER_H }}>
            <div className="flex items-center gap-2">
              <span className={`display text-[1.55rem] ${isCurrent ? 'text-white' : 'text-soft'}`}>{ROUND_LABEL[r.round]}</span>
              {isCurrent && <span className="live-dot" title="Current round" />}
            </div>
            <div className="label text-[0.66rem] text-mute">
              {played}/{r.matches.length} played
              {layout.byes[ci] > 0 && <span className="text-warn"> · {layout.byes[ci]} bye</span>}
            </div>
          </div>
        )
      })}
      {showChampion && (
        <div className="absolute flex flex-col justify-center" style={{ left: colX(rounds.length), top: 0, width: CHAMP_W, height: HEADER_H }}>
          <span className="display text-[1.55rem] text-gold">Champion</span>
        </div>
      )}

      <svg className="absolute left-0" style={{ top: HEADER_H }} width={totalW} height={layout.bodyH} aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5}>
          {dim.map((l, i) => (
            <motion.path key={l.from.id} d={pathFor(l)} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.2 + l.col1 * 0.15 + (i % 5) * 0.01, ease: 'easeOut' }} />
          ))}
          {finalLink && finalMatch?.status !== 'COMPLETED' && <path d={finalLink} />}
        </g>
        <g fill="none" stroke="#2bff88" strokeWidth={1.6} style={{ filter: 'drop-shadow(0 0 4px rgba(43,255,136,0.7))' }}>
          {lit.map((l, i) => (
            <motion.path key={l.from.id} d={pathFor(l)} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.2 + l.col1 * 0.15 + (i % 5) * 0.01, ease: 'easeOut' }} />
          ))}
          {finalLink && finalMatch?.status === 'COMPLETED' && <path d={finalLink} />}
        </g>
      </svg>

      {rounds.map((r) =>
        r.matches.map((m) => {
          const p = layout.pos.get(m.id)!
          return (
            <div key={m.id} className="absolute" style={{ left: colX(p.col), top: HEADER_H + p.y - BOX_H / 2, width: BOX_W, height: BOX_H }}>
              <BracketMatch match={m} byId={byId} />
            </div>
          )
        }),
      )}

      {showChampion && layout.finalY !== null && (
        <div className="absolute" style={{ left: colX(rounds.length), top: HEADER_H + layout.finalY - 70, width: CHAMP_W }}>
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
      )}
    </div>
  )
}

type RoundGroup = { round: Round; matches: Match[] }

/** Round-by-round list: used on phones, and on larger screens as an alternative to the tree. */
function RoundsView({ rounds, byId, initialRound }: { rounds: RoundGroup[]; byId: Map<string, Player>; initialRound: Round | null }) {
  const [picked, setPicked] = useState<Round | null>(initialRound)
  const active = rounds.find((r) => r.round === picked) ?? rounds.find((r) => r.round === initialRound) ?? rounds[0]
  return (
    <div>
      <div className="hide-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist" aria-label="Bracket rounds">
        {rounds.map((r) => {
          const on = active?.round === r.round
          const played = r.matches.filter((m) => m.status === 'COMPLETED').length
          return (
            <button
              key={r.round}
              role="tab"
              aria-selected={on}
              onClick={() => setPicked(r.round)}
              className={`label shrink-0 px-4 py-3 text-[0.85rem] ring-1 ring-inset transition-colors ${
                on ? 'bg-pitch text-ink-950 ring-pitch' : 'bg-white/[0.04] text-soft ring-white/12 hover:text-white'
              }`}
            >
              {ROUND_LABEL[r.round]}
              <span className={`num ml-2 text-[0.8rem] ${on ? 'text-ink-950/70' : 'text-mute'}`}>
                {played}/{r.matches.length}
              </span>
            </button>
          )
        })}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" key={active?.round}>
        {active?.matches.map((m, i) => (
          <MatchCard key={m.id} match={m} byId={byId} index={i} />
        ))}
      </div>
    </div>
  )
}

interface BracketProps {
  /** How a bracket with MORE than 4 rounds (32 or 64 players) opens on large screens. Default: the full tree. */
  largeAs?: 'tree' | 'rounds'
}

export function KnockoutBracket({ largeAs = 'tree' }: BracketProps) {
  const { matches, rounds, byId, tournament, loading } = useMatches()
  const wide = useMediaQuery('(min-width: 768px)')
  const [chosen, setChosen] = useState<'tree' | 'rounds' | null>(null)
  const big = rounds.length > 4
  const view = chosen ?? (big ? largeAs : 'tree')
  const showTree = wide && view === 'tree'
  const roundKeys = rounds.map((r) => r.round).join()
  const initialRound = tournament.currentRound ?? rounds[0]?.round ?? null

  const scroller = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  useEffect(() => {
    const el = scroller.current
    if (!el) {
      setOverflowing(false)
      return
    }
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 8)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [roundKeys, loading, matches.length, showTree])

  if (loading) return <BracketSkeleton />

  if (rounds.length === 0) {
    return (
      <EmptyState
        icon={<GitBranch size={26} />}
        title="Bracket pending"
        message="The knockout bracket will appear here as soon as the fixtures are confirmed."
      />
    )
  }

  const hint = (
    <div className="label flex items-center gap-2 text-[0.72rem] text-mute">
      Scroll sideways to see every round <span aria-hidden>→</span>
    </div>
  )

  return (
    <>
      {/* larger screens, big brackets: choose full tree or round-by-round */}
      {wide && big && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex" role="group" aria-label="Bracket view">
            {(
              [
                ['tree', 'Full bracket', GitBranch],
                ['rounds', 'By round', LayoutList],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setChosen(key)}
                aria-pressed={view === key}
                className={`label flex items-center gap-2 px-4 py-2.5 text-[0.8rem] ring-1 ring-inset transition-colors ${
                  view === key ? 'bg-pitch text-ink-950 ring-pitch' : 'bg-white/[0.04] text-soft ring-white/12 hover:text-white'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          {showTree && overflowing && hint}
        </div>
      )}
      {showTree && !big && overflowing && <div className="mb-2 flex justify-end">{hint}</div>}

      {showTree ? (
        <div ref={scroller} className="panel overflow-x-auto overscroll-x-contain p-6">
          <div className="mx-auto w-max">
            <Tree rounds={rounds} all={matches} byId={byId} currentRound={tournament.currentRound} />
          </div>
        </div>
      ) : (
        <RoundsView rounds={rounds} byId={byId} initialRound={initialRound} />
      )}
    </>
  )
}
