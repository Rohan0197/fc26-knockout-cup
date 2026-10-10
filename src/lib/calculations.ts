import type { Match, Player, PlayerStatus, Standing, TournamentState } from '../types'
import { ROUND_ORDER, compareMatches } from './bracket'

/**
 * All statistics are DERIVED from completed matches:
 *   wins    = completed matches where winner_id = player
 *   losses  = completed matches the player played but did not win
 *   points  = wins            (win = 1, loss = 0)
 *   played  = wins + losses
 *   win %   = wins / played * 100
 * Mirrors the player_standings SQL view.
 */
export function computeStandings(players: Player[], matches: Match[]): Standing[] {
  const completed = matches.filter((m) => m.status === 'COMPLETED' && m.winner_id)
  const live = matches.filter((m) => m.status !== 'CANCELLED')

  const final = live.find((m) => m.round === 'FINAL')
  const championId = final?.status === 'COMPLETED' ? final.winner_id : null

  const rows = players.map((player, order) => {
    const mine = completed.filter((m) => m.player1_id === player.id || m.player2_id === player.id)
    const wins = mine.filter((m) => m.winner_id === player.id).length
    const losses = mine.length - wins
    const played = wins + losses

    // A loss no longer ends a player's tournament (the admin can give anyone another match). A player is OUT only
    // when their latest result was a loss and nothing is scheduled for them.
    const hasOpenMatch = live.some(
      (m) => m.status !== 'COMPLETED' && (m.player1_id === player.id || m.player2_id === player.id),
    )
    const latest = mine.slice().sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at))[0]
    const lastWasWin = latest?.winner_id === player.id

    let status: PlayerStatus
    if (championId === player.id) status = 'CHAMPION'
    else if (hasOpenMatch) status = 'ACTIVE'
    else if (played === 0) status = 'WAITING'
    else status = lastWasWin ? 'ACTIVE' : 'ELIMINATED'

    return {
      order,
      player,
      played,
      wins,
      losses,
      points: wins,
      winPct: played === 0 ? 0 : Math.round((wins / played) * 100),
      status,
    }
  })

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      Number(a.played === 0) - Number(b.played === 0) ||
      b.winPct - a.winPct ||
      a.order - b.order, // final tie-break: registration order (players arrive oldest-first)
  )

  return rows.map(({ order: _order, ...r }, i) => ({ ...r, rank: i + 1 }))
}

export function computeTournamentState(matches: Match[], players: Player[]): TournamentState {
  const active = matches.filter((m) => m.status !== 'CANCELLED')
  const completed = active.filter((m) => m.status === 'COMPLETED').length
  const remaining = active.length - completed

  if (active.length === 0) {
    return { phase: 'PENDING', currentRound: null, totalMatches: 0, completed: 0, remaining: 0, champion: null }
  }

  const final = active.find((m) => m.round === 'FINAL')
  const champion =
    final?.status === 'COMPLETED' ? (players.find((p) => p.id === final.winner_id) ?? null) : null

  const currentRound =
    ROUND_ORDER.find((r) => active.some((m) => m.round === r && m.status !== 'COMPLETED')) ??
    (champion ? 'FINAL' : ([...ROUND_ORDER].reverse().find((r) => active.some((m) => m.round === r)) ?? null))

  // "Complete" means the last round of the bracket is a single finished match. Every fixture being played is not enough:
  // a bracket that so far only has its first round (all played) is still waiting for the later rounds.
  const lastRound = [...ROUND_ORDER].reverse().find((r) => active.some((m) => m.round === r))
  const lastRoundMatches = lastRound ? active.filter((m) => m.round === lastRound) : []
  const finished = lastRoundMatches.length === 1 && lastRoundMatches[0].status === 'COMPLETED' && remaining === 0

  return {
    phase: champion || finished ? 'COMPLETE' : 'LIVE',
    currentRound,
    totalMatches: active.length,
    completed,
    remaining,
    champion,
  }
}

export function recentResults(matches: Match[], limit = 4): Match[] {
  return matches
    .filter((m) => m.status === 'COMPLETED')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    .slice(0, limit)
}

/** Next matches to be played: LIVE first, then by scheduled time (unscheduled last), then bracket order. */
export function upcomingMatches(matches: Match[], limit = 4): Match[] {
  return matches
    .filter((m) => (m.status === 'UPCOMING' || m.status === 'LIVE') && m.player1_id && m.player2_id)
    .sort((a, b) => {
      if ((a.status === 'LIVE') !== (b.status === 'LIVE')) return a.status === 'LIVE' ? -1 : 1
      const at = a.scheduled_at ?? '9999'
      const bt = b.scheduled_at ?? '9999'
      return at.localeCompare(bt) || compareMatches(a, b)
    })
    .slice(0, limit)
}

export const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
