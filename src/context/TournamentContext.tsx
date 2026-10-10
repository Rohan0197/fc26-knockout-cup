import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Match, Player, Standing, TournamentSettings, TournamentState } from '../types'
import { backend } from '../lib/api'
import { computeStandings, computeTournamentState } from '../lib/calculations'

type LoadStatus = 'loading' | 'ready' | 'error'

interface TournamentContextValue {
  players: Player[]
  matches: Match[]
  settings: TournamentSettings
  standings: Standing[]
  tournament: TournamentState
  status: LoadStatus
  error: string | null
  /** Re-fetch from the backend (called after admin writes and on realtime pings). */
  refresh: () => Promise<void>
  /** false until the one-time database upgrade (migration 003) has been run; new features hide themselves meanwhile. */
  schemaReady: boolean
  /** Bumps whenever data changed after the first load - drives the "LIVE UPDATE" indicator. */
  liveTick: number
  mode: 'supabase' | 'demo'
}

const DEFAULT_SETTINGS: TournamentSettings = {
  name: 'FC 26 Knockout Cup',
  subtitle: 'The Road to the Final',
  organizer: 'IT Committee, IIM Bodh Gaya',
  advancement_mode: 'MANUAL',
}

const Ctx = createContext<TournamentContextValue | null>(null)

/** Cheap change detector so the live indicator only fires on real changes. */
const signature = (players: Player[], matches: Match[], s: TournamentSettings) =>
  JSON.stringify([
    players.map((p) => [p.id, p.name, p.avatar_url, p.club]),
    matches.map((m) => [m.id, m.status, m.player1_id, m.player2_id, m.player1_score, m.player2_score, m.scheduled_at]),
    s,
  ])

export function TournamentProvider({ children }: { children: ReactNode }) {
  const api = backend!.api
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [settings, setSettings] = useState<TournamentSettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [liveTick, setLiveTick] = useState(0)
  const [schemaReady, setSchemaReady] = useState(true)
  const sig = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.fetchAll()
      const next = signature(data.players, data.matches, data.settings)
      if (sig.current !== null && next !== sig.current) setLiveTick((t) => t + 1)
      sig.current = next
      setPlayers(data.players)
      setMatches(data.matches)
      setSettings(data.settings)
      setSchemaReady(data.schemaUpgraded)
      setError(null)
      setStatus('ready')
    } catch (e) {
      // Keep showing the last good data on a failed background refresh.
      setError(e instanceof Error ? e.message : 'Could not load tournament data.')
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'))
    }
  }, [api])

  useEffect(() => {
    void refresh()
    const off = api.subscribe(() => void refresh())
    return off
  }, [api, refresh])

  useEffect(() => {
    document.title = settings.name
  }, [settings.name])

  const standings = useMemo(() => computeStandings(players, matches), [players, matches])
  const tournament = useMemo(() => computeTournamentState(matches, players), [matches, players])

  const value = useMemo<TournamentContextValue>(
    () => ({ players, matches, settings, standings, tournament, status, error, refresh, schemaReady, liveTick, mode: api.mode }),
    [players, matches, settings, standings, tournament, status, error, refresh, schemaReady, liveTick, api.mode],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTournament() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTournament must be used inside <TournamentProvider>')
  return v
}
