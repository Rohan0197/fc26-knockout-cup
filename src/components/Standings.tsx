import { motion, type Variants } from 'framer-motion'
import type { Standing } from '../types'
import { pad2 } from '../utils/format'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { PlayerAvatar } from './ui/PlayerAvatar'
import { PlayerStatusChip } from './PlayerStatusChip'

const COLS = 'md:grid-cols-[64px_minmax(0,1fr)_84px_60px_60px_92px_130px]'

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } } }
const item: Variants = {
  hidden: { opacity: 0, x: -18 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

/** Medal styling only applies once a player has actually won something - no gold for an empty table. */
function medal(s: Standing) {
  if (s.points === 0 || s.rank > 3) return null
  return (['gold', 'silver', 'bronze'] as const)[s.rank - 1]
}

const MEDAL = {
  gold: { text: 'text-gold', bar: 'bg-gold', bg: 'bg-gradient-to-r from-gold/[0.16] via-gold/[0.05] to-transparent' },
  silver: { text: 'text-silver', bar: 'bg-silver', bg: 'bg-gradient-to-r from-silver/[0.10] via-silver/[0.03] to-transparent' },
  bronze: { text: 'text-bronze', bar: 'bg-bronze', bg: 'bg-gradient-to-r from-bronze/[0.10] via-bronze/[0.03] to-transparent' },
} as const

function Row({ s }: { s: Standing }) {
  const m = medal(s)
  const style = m ? MEDAL[m] : null
  const first = m === 'gold'
  const out = s.status === 'ELIMINATED'

  return (
    <motion.div variants={item} layout="position">
      <div
        className={`group relative block border-b border-white/[0.05] transition-colors last:border-b-0 hover:bg-white/[0.045] ${style?.bg ?? ''}`}
      >
        {style && <span className={`absolute inset-y-0 left-0 ${first ? 'w-1' : 'w-[3px]'} ${style.bar}`} />}

        {/* desktop row */}
        <div className={`hidden items-center gap-0 px-4 md:grid ${COLS} ${first ? 'py-5' : 'py-3.5'}`}>
          <span className={`display text-4xl ${style?.text ?? 'text-mute'} ${first ? '!text-5xl' : ''}`}>{pad2(s.rank)}</span>
          <span className="flex min-w-0 items-center gap-4">
            <PlayerAvatar player={s.player} size={first ? 56 : 44} className={out ? 'opacity-60 grayscale' : ''} />
            <span className="min-w-0">
              <span
                className={`display block truncate ${
                  first ? 'text-4xl' : 'text-2xl'
                } ${out ? 'text-soft' : 'text-white'}`}
              >
                {s.player.name}
              </span>
              <span className="mt-1 flex items-center gap-2">
                <PlayerStatusChip status={s.status} />
                {s.player.club && <span className="truncate text-xs text-mute">{s.player.club}</span>}
              </span>
            </span>
          </span>
          <span className="num text-center text-2xl text-soft">{s.played}</span>
          <span className="num text-center text-2xl text-white">{s.wins}</span>
          <span className="num text-center text-2xl text-soft">{s.losses}</span>
          <span className={`num text-center ${first ? 'text-5xl' : 'text-4xl'} ${style?.text ?? 'text-white'}`}>
            <AnimatedNumber value={s.points} />
          </span>
          <span className="flex flex-col items-end gap-1.5">
            <span className="num text-2xl text-soft">
              <AnimatedNumber value={s.winPct} suffix="%" />
            </span>
            <span className="h-[3px] w-full max-w-[96px] bg-white/10">
              <motion.span
                className={`block h-full ${style?.bar ?? 'bg-pitch'}`}
                initial={{ width: 0 }}
                animate={{ width: `${s.winPct}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
          </span>
        </div>

        {/* mobile card */}
        <div className="flex items-center gap-3 px-3.5 py-3.5 md:hidden">
          <span className={`display w-9 shrink-0 text-3xl ${style?.text ?? 'text-mute'}`}>{pad2(s.rank)}</span>
          <PlayerAvatar player={s.player} size={44} className={out ? 'opacity-60 grayscale' : ''} />
          <span className="min-w-0 flex-1">
            <span className={`display block truncate text-2xl ${out ? 'text-soft' : 'text-white'}`}>{s.player.name}</span>
            <span className="mt-1 flex items-center gap-2 text-xs text-mute">
              <PlayerStatusChip status={s.status} />
              <span className="num text-sm">
                {s.wins}W · {s.losses}L
              </span>
            </span>
          </span>
          <span className="text-right">
            <span className={`num block text-4xl leading-none ${style?.text ?? 'text-white'}`}>
              <AnimatedNumber value={s.points} />
            </span>
            <span className="label text-[0.6rem] text-mute">PTS</span>
          </span>
        </div>
      </div>
    </motion.div>
  )
}

interface Props {
  standings: Standing[]
  /** Show only the top N (home page preview). */
  limit?: number
}

export function Standings({ standings, limit }: Props) {
  const rows = limit ? standings.slice(0, limit) : standings
  return (
    <div className="panel overflow-hidden">
      <div
        className={`label hidden items-center px-4 py-3 text-[0.76rem] text-mute md:grid ${COLS} border-b border-white/[0.08] bg-white/[0.025]`}
      >
        <span>Rank</span>
        <span>Player</span>
        <span className="text-center">Played</span>
        <span className="text-center">W</span>
        <span className="text-center">L</span>
        <span className="text-center">Points</span>
        <span className="text-right">Win %</span>
      </div>
      <motion.div variants={container} initial="hidden" animate="show">
        {rows.map((s) => (
          <Row key={s.player.id} s={s} />
        ))}
      </motion.div>
    </div>
  )
}
