import { useMemo } from 'react'
import { useTournament } from '../context/TournamentContext'

export function usePlayers() {
  const { players, status, error } = useTournament()
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  return { players, byId, loading: status === 'loading', error }
}
