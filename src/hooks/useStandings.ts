import { useTournament } from '../context/TournamentContext'

export function useStandings() {
  const { standings, status } = useTournament()
  return { standings, loading: status === 'loading' }
}
