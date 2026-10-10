import { useMemo } from 'react'
import { Lock, Wand2 } from 'lucide-react'
import type { Match } from '../../types'
import { backend } from '../../lib/api'
import { ROUND_LABEL, groupByRound, isBracketMatch, resolveNext } from '../../lib/bracket'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'
import { pad2 } from '../../utils/format'
import { useToast } from '../ui/Toast'

const api = backend!.api

/**
 * The admin decides who goes to each next-round match: pick ANY player for a slot (a winner, a loser, anyone).
 * "Fill from winners" does what automatic mode would do, in one click, and every slot can still be changed afterwards.
 */
export function AdvancePlayers() {
  const { matches, players, settings } = useTournament()
  const run = useAdminAction()
  const toast = useToast()
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const bracket = useMemo(() => matches.filter(isBracketMatch), [matches])
  const rounds = useMemo(() => groupByRound(bracket).slice(1), [bracket]) // the first round comes from the draw

  // who feeds each slot of each match?
  const feeders = useMemo(() => {
    const map = new Map<string, { from: Match; slot: 1 | 2 }[]>()
    for (const m of bracket) {
      const nx = resolveNext(m, bracket)
      if (nx?.match) map.set(nx.match.id, [...(map.get(nx.match.id) ?? []), { from: m, slot: nx.slot }])
    }
    return map
  }, [bracket])

  // only players who have already played a match (a bracket match or an extra match) can be placed
  const played = useMemo(() => {
    const ids = new Set<string>()
    for (const m of matches) if (m.status === 'COMPLETED') for (const id of [m.player1_id, m.player2_id]) if (id) ids.add(id)
    return ids
  }, [matches])

  const name = (id: string | null) => (id ? (byId.get(id)?.name ?? '?') : 'TBD')

  if (rounds.length === 0) return null
  const manual = settings.advancement_mode === 'MANUAL'

  const place = async (match: Match, slot: 1 | 2, playerId: string) => {
    const other = slot === 1 ? match.player2_id : match.player1_id
    if (playerId && playerId === other) {
      toast.error("A player can't play themselves. Choose someone else.")
      return
    }
    await run(
      () => api.updateMatch(match.id, slot === 1 ? { player1_id: playerId || null } : { player2_id: playerId || null }),
      playerId ? `${name(playerId)} placed.` : 'Slot cleared.',
    )
  }

  const winnerFor = (m: Match, slot: 1 | 2) => {
    const f = feeders.get(m.id)?.find((x) => x.slot === slot)?.from
    return f?.status === 'COMPLETED' ? f.winner_id : null
  }

  const fillRound = async (round: (typeof rounds)[number]) => {
    let placed = 0
    for (const m of round.matches) {
      if (m.status === 'COMPLETED' || m.status === 'CANCELLED') continue
      const patch: { player1_id?: string; player2_id?: string } = {}
      const w1 = winnerFor(m, 1)
      const w2 = winnerFor(m, 2)
      if (w1 && !m.player1_id) patch.player1_id = w1
      if (w2 && !m.player2_id) patch.player2_id = w2
      if (Object.keys(patch).length === 0) continue
      const ok = await run(() => api.updateMatch(m.id, patch), `${ROUND_LABEL[m.round]} match ${m.match_number}: winners placed.`)
      if (!ok) return
      placed++
    }
    if (placed === 0) toast.success('Nothing to fill: every slot that has a finished feeder match is already placed.')
  }

  return (
    <section className="mt-8">
      <h2 className="display text-3xl text-white">Advance players</h2>
      <p className="mb-5 mt-1 max-w-2xl text-sm text-mute">
        {manual
          ? "You decide who goes to each next-round match. Results don't move anyone by themselves. Pick any player for a slot, or fill empty slots from the winners and then change whichever you like."
          : 'Automatic mode is on, so winners are placed for you. You can still change a slot here before that match is played (a later correction of the earlier result may overwrite it).'}
      </p>

      <div className="space-y-6">
        {rounds.map((round) => {
          // players that appear more than once in this round (a hint, not an error)
          const seen = new Map<string, number>()
          for (const m of round.matches)
            if (m.status !== 'CANCELLED') for (const id of [m.player1_id, m.player2_id]) if (id) seen.set(id, (seen.get(id) ?? 0) + 1)
          const canFill = round.matches.some(
            (m) => m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && ((winnerFor(m, 1) && !m.player1_id) || (winnerFor(m, 2) && !m.player2_id)),
          )

          return (
            <div key={round.round} className="panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
                <h3 className="display text-2xl text-white">{ROUND_LABEL[round.round]}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => void fillRound(round)} disabled={!canFill}>
                  <Wand2 size={14} /> Fill empty slots from winners
                </button>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {round.matches.map((m) => {
                  const locked = m.status === 'COMPLETED' || m.status === 'CANCELLED'
                  return (
                    <div key={m.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[3rem_1fr_1fr] sm:items-start sm:px-5">
                      <span className="num pt-2 text-xl text-mute">M{pad2(m.match_number)}</span>
                      {([1, 2] as const).map((slot) => {
                        const value = (slot === 1 ? m.player1_id : m.player2_id) ?? ''
                        const feeder = feeders.get(m.id)?.find((x) => x.slot === slot)?.from
                        const winner = winnerFor(m, slot)
                        const dup = value && (seen.get(value) ?? 0) > 1
                        return (
                          <div key={slot}>
                            <div className="flex items-center gap-2">
                              <select
                                className="input"
                                value={value}
                                disabled={locked}
                                aria-label={`${ROUND_LABEL[m.round]} match ${m.match_number}, player ${slot}`}
                                onChange={(e) => void place(m, slot, e.target.value)}
                              >
                                <option value="">TBD</option>
                                {players.filter((p) => played.has(p.id) || p.id === value).map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              {locked && <Lock size={14} className="shrink-0 text-mute" aria-label="Locked: already played" />}
                            </div>
                            <div className="mt-1 min-h-[1.1rem] text-xs text-mute">
                              {feeder ? (
                                feeder.status === 'COMPLETED' ? (
                                  <>
                                    Winner of {ROUND_LABEL[feeder.round]} M{feeder.match_number}: <span className="text-soft">{name(winner)}</span>
                                    {!locked && winner && winner !== value && (
                                      <button className="ml-2 text-pitch underline-offset-2 hover:underline" onClick={() => void place(m, slot, winner)}>
                                        Use winner
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <>Waiting for {ROUND_LABEL[feeder.round]} M{feeder.match_number}</>
                                )
                              ) : null}
                              {dup && <span className="ml-2 text-warn">Also placed in another match this round</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
