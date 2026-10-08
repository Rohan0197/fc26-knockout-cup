import { memo } from 'react'
import { motion } from 'framer-motion'
import type { Standing } from '../types'
import { pad2 } from '../utils/format'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { PlayerAvatar } from './ui/PlayerAvatar'
import { PlayerStatusChip } from './PlayerStatusChip'

interface Props {
  standing: Standing
  index?: number
}

function PlayerCardImpl({ standing: s, index = 0 }: Props) {
  const leader = s.rank === 1 && s.points > 0
  const out = s.status === 'ELIMINATED'
  const accent = leader ? '#e6c36a' : '#2bff88'

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -5% 0px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -7 }}
      className="group drop-shadow-[0_0_0_transparent] transition-[filter] duration-300 hover:drop-shadow-[0_16px_30px_rgba(43,255,136,0.16)]"
      style={{ ['--accent' as string]: accent }}
    >
      <article className="panel panel-both relative block overflow-hidden" aria-label={`${s.player.name}, rank ${s.rank}`}>
        {/* artwork */}
        <div className="relative aspect-[5/4] overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(90% 80% at 50% 100%, ${leader ? 'rgba(230,195,106,0.30)' : 'rgba(43,255,136,0.22)'}, transparent 70%), linear-gradient(160deg, #1a212d 0%, #0b0f15 70%)`,
            }}
          />
          {/* diagonal FC-style stripes */}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.045)_0_2px,transparent_2px_26px)] opacity-70" />
          <div
            className="absolute -right-10 top-0 h-full w-24 -skew-x-[20deg] opacity-90 transition-transform duration-500 group-hover:translate-x-3"
            style={{ background: `linear-gradient(180deg, ${accent}33, transparent)` }}
          />
          {/* big ghost rank */}
          <span className="display pointer-events-none absolute -left-1 -top-2 select-none text-[6.5rem] leading-none text-white/[0.06] sm:text-[8rem]">
            {pad2(s.rank)}
          </span>

          {/* player art */}
          <div
            className={`absolute inset-x-[16%] bottom-0 top-[10%] transition-transform duration-500 group-hover:scale-[1.05] ${
              out ? 'opacity-55 grayscale' : ''
            }`}
          >
            <PlayerAvatar player={s.player} fill plain className="!bg-transparent [mask-image:linear-gradient(to_bottom,black_70%,transparent)]" />
          </div>

          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            <span className="display text-3xl leading-none" style={{ color: leader ? accent : '#fff' }}>
              #{pad2(s.rank)}
            </span>
          </div>
          <div className="absolute right-3 top-3">
            <PlayerStatusChip status={s.status} />
          </div>

          {/* animated accent line */}
          <span className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-white/10">
            <span
              className="absolute inset-y-0 w-1/3 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-[3]"
              style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
            />
          </span>
          {/* light sweep on hover */}
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:animate-[sweep_1.1s_ease-out_1] group-hover:opacity-100" />
        </div>

        {/* details */}
        <div className="px-4 pb-4 pt-3 sm:px-5">
          <h2 className={`display truncate text-[1.65rem] leading-none sm:text-3xl ${out ? 'text-soft' : 'text-white'}`}>
            {s.player.name}
          </h2>
          <div className="label mt-1.5 truncate text-[0.72rem] text-mute">{s.player.club ?? 'Independent'}</div>

          <div className="mt-4 grid grid-cols-3 border-t border-white/[0.08] pt-3">
            <Stat label="W" value={s.wins} />
            <Stat label="L" value={s.losses} />
            <Stat label="Points" value={s.points} accent={leader} highlight />
          </div>
        </div>
      </article>
    </motion.div>
  )
}

function Stat({ label, value, highlight, accent }: { label: string; value: number; highlight?: boolean; accent?: boolean }) {
  return (
    <div className={highlight ? 'border-l border-white/[0.08] pl-3' : ''}>
      <div className="label text-[0.66rem] text-mute">{label}</div>
      <div className={`num text-[2rem] leading-none ${highlight ? (accent ? 'text-gold' : 'text-pitch') : 'text-white'}`}>
        <AnimatedNumber value={value} />
      </div>
    </div>
  )
}

export const PlayerCard = memo(PlayerCardImpl)
