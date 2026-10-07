import type { MatchStatus } from '../../types'
import { STATUS_LABEL } from '../../utils/format'

const STYLES: Record<MatchStatus, string> = {
  LIVE: 'bg-pitch/15 text-pitch ring-pitch/50',
  UPCOMING: 'bg-white/[0.06] text-soft ring-white/15',
  COMPLETED: 'bg-white/[0.06] text-white ring-white/20',
  CANCELLED: 'bg-danger/10 text-danger ring-danger/40',
}

export function StatusPill({ status }: { status: MatchStatus }) {
  return (
    <span
      className={`label inline-flex items-center gap-1.5 px-2 py-[3px] text-[0.7rem] tracking-[0.2em] ring-1 ring-inset ${STYLES[status]}`}
    >
      {status === 'LIVE' && <span className="live-dot !h-1.5 !w-1.5" />}
      {STATUS_LABEL[status]}
    </span>
  )
}
