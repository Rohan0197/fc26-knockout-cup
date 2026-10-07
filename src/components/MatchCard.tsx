import { memo } from 'react'
import { motion } from 'framer-motion'
import type { Match, Player } from '../types'
import { ROUND_LABEL } from '../lib/bracket'
import { fmtDate, fmtKickoff, pad2 } from '../utils/format'
import { PlayerAvatar } from './ui/PlayerAvatar'
import { StatusPill } from './ui/StatusPill'

interface Props {
  match: Match
  byId: Map<string, Player>
  /** Stagger index for the entrance animation. */
  index?: number
  /** Highlight this player's row (used on player profiles). */
  focusPlayerId?: string
}

function Side({
  player,
  score,
  isWinner,
  isLoser,
  focus,
}: {
  player: Player | null
  score: number | null
  isWinner: boolean
  isLoser: boolean
  focus: boolean
}) {
  const name = (
    <span
      className={`display block truncate text-[1.7rem] leading-none sm:text-3xl ${
        !player ? 'text-mute/70' : isLoser ? 'text-soft/60' : 'text-white'
      }`}
    >
      {player ? player.name : 'TBD'}
    </span>
  )
  return (
    <div
      className={`relative flex items-center gap-3 px-3 py-2.5 transition-colors sm:gap-4 sm:px-4 ${
        isWinner ? 'bg-pitch/[0.09]' : focus ? 'bg-white/[0.05]' : ''
      }`}
    >
      {isWinner && <span className="absolute inset-y-0 left-0 w-[3px] bg-pitch shadow-[0_0_12px_rgba(43,255,136,0.8)]" />}
      {player ? (
        <PlayerAvatar player={player} size={40} className={isLoser ? 'opacity-50 grayscale' : ''} />
      ) : (
        <div className="h-10 w-10 shrink-0 border border-dashed border-white/15" />
      )}
      <div className="min-w-0 flex-1">
        {name}
        {isWinner && <span className="label mt-1 block text-[0.68rem] tracking-[0.25em] text-pitch">Winner</span>}
      </div>
      {score !== null && (
        <span
          className={`num grid h-11 min-w-11 place-items-center px-2 text-3xl leading-none ${
            isWinner ? 'bg-pitch text-ink-950' : 'bg-white/[0.07] text-soft'
          }`}
        >
          {score}
        </span>
      )}
    </div>
  )
}

function MatchCardImpl({ match, byId, index = 0, focusPlayerId }: Props) {
  const p1 = match.player1_id ? (byId.get(match.player1_id) ?? null) : null
  const p2 = match.player2_id ? (byId.get(match.player2_id) ?? null) : null
  const done = match.status === 'COMPLETED'
  const winner = done && match.winner_id ? byId.get(match.winner_id) : null

  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -6% 0px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="group drop-shadow-[0_0_0_rgba(43,255,136,0)] transition-[filter] duration-300 hover:drop-shadow-[0_12px_28px_rgba(43,255,136,0.12)]"
    >
      <div className={`panel overflow-hidden ${match.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
        {done && <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-pitch via-pitch/40 to-transparent" />}
        {match.status === 'LIVE' && (
          <span className="absolute inset-x-0 top-0 h-[2px] animate-pulse bg-pitch shadow-[0_0_12px_rgba(43,255,136,0.9)]" />
        )}

        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          <div>
            <div className="eyebrow !text-[0.74rem] !tracking-[0.26em]">{ROUND_LABEL[match.round]}</div>
            <div className="label mt-1 text-[0.72rem] text-mute">Match {pad2(match.match_number)}</div>
          </div>
          <StatusPill status={match.status} />
        </div>

        <div className="relative pb-1">
          <Side
            player={p1}
            score={done ? match.player1_score : null}
            isWinner={done && match.winner_id === match.player1_id}
            isLoser={done && match.winner_id !== match.player1_id}
            focus={focusPlayerId === match.player1_id}
          />
          <div className="relative flex items-center px-4 sm:px-5" aria-hidden>
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="display px-3 text-sm text-mute">VS</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <Side
            player={p2}
            score={done ? match.player2_score : null}
            isWinner={done && match.winner_id === match.player2_id}
            isLoser={done && match.winner_id !== match.player2_id}
            focus={focusPlayerId === match.player2_id}
          />
        </div>

        <div className="label flex items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[0.8rem] text-mute sm:px-5">
          {done ? (
            <>
              <span>Full time</span>
              <span className="truncate text-white">
                Winner <span className="text-pitch">{winner?.name}</span>
              </span>
            </>
          ) : (
            <>
              <span className={match.status === 'LIVE' ? 'text-pitch' : ''}>
                {match.status === 'LIVE' ? 'In play now' : fmtKickoff(match.scheduled_at)}
              </span>
              {match.scheduled_at && <span>{fmtDate(match.scheduled_at)}</span>}
            </>
          )}
        </div>
      </div>
    </motion.article>
  )
}

export const MatchCard = memo(MatchCardImpl)
