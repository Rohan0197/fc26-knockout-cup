import { useMemo } from 'react'
import { useTournament } from '../context/TournamentContext'
import { groupByRound } from '../lib/bracket'
import { recentResults, upcomingMatches } from '../lib/calculations'
import { usePlayers } from './usePlayers'

export function useMatches() {
  const { matches, status, tournament } = useTournament()
  const { byId } = usePlayers()
  // the bracket tree only ever shows bracket rounds; extra matches live on Fixtures / Results
  const rounds = useMemo(() => groupByRound(matches.filter((m) => m.round !== 'EXTRA')), [matches])
  const recent = useMemo(() => recentResults(matches, 3), [matches])
  const next = useMemo(() => upcomingMatches(matches, 3), [matches])
  return { matches, rounds, recent, next, byId, tournament, loading: status === 'loading' }
}
