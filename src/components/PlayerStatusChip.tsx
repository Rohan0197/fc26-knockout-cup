import { Crown } from 'lucide-react'
import type { PlayerStatus } from '../types'

const MAP: Record<PlayerStatus, { label: string; cls: string }> = {
  CHAMPION: { label: 'Champion', cls: 'text-gold bg-gold/10 ring-gold/40' },
  ACTIVE: { label: 'Still in', cls: 'text-pitch bg-pitch/10 ring-pitch/35' },
  ELIMINATED: { label: 'Eliminated', cls: 'text-mute bg-white/[0.04] ring-white/10' },
  WAITING: { label: 'Awaiting', cls: 'text-soft bg-white/[0.05] ring-white/12' },
}

export function PlayerStatusChip({ status }: { status: PlayerStatus }) {
  const s = MAP[status]
  return (
    <span className={`label inline-flex items-center gap-1 px-1.5 py-[2px] text-[0.64rem] tracking-[0.18em] ring-1 ring-inset ${s.cls}`}>
      {status === 'CHAMPION' && <Crown size={10} />}
      {s.label}
    </span>
  )
}
