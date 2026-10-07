/**
 * DEVELOPMENT-ONLY backend. Used when no Supabase project is configured (and only in dev builds).
 * Keeps everything in this browser's localStorage and re-implements the same rules the real
 * database enforces in supabase/schema.sql (no draws, derived winner, bracket advancement,
 * correction handling), so the whole UI can be exercised before Supabase is connected.
 *
 * None of this ships as production data: in a production build without Supabase env vars the app
 * shows a "setup required" screen instead.
 */
import type { AdminSession, Match, MatchInput, Player, PlayerInput, TournamentSettings } from '../types'
import type { AuthApi, TournamentApi, TournamentData } from './queries'
import { ROUND_LABEL, advancementTarget, buildBracketSkeleton } from './bracket'
import { normalizeName } from './calculations'

const KEY = 'fc26-demo-state-v2'
const AUTH_KEY = 'fc26-demo-auth-v1'

export const DEMO_ADMIN = { email: 'demo@fc26.cup', password: 'demo1234' }

const DEFAULT_SETTINGS: TournamentSettings = {
  name: 'FC 26 Knockout Cup',
  subtitle: 'The Road to the Final',
  organizer: 'IT Committee, IIM Bodh Gaya',
}

const uid = () => crypto.randomUUID()
const nowIso = () => new Date().toISOString()

/* ------------------------------------------------------------------ state persistence */

function load(): TournamentData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as TournamentData
  } catch {
    /* fall through to reseed */
  }
  const seeded = seed()
  save(seeded)
  return seeded
}

function save(state: TournamentData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable - demo state simply won't persist */
  }
}

/* ------------------------------------------------------------------ rules (mirror of SQL) */

function applyMatchWrite(state: TournamentData, next: Match, prev: Match | null) {
  if (
    prev?.status === 'COMPLETED' &&
    next.status === 'COMPLETED' &&
    (prev.player1_id !== next.player1_id ||
      prev.player2_id !== next.player2_id ||
      prev.round !== next.round ||
      prev.match_number !== next.match_number)
  ) {
    throw new Error('Players, round and match number of a completed match cannot be changed. Correct the result instead.')
  }

  if (next.status === 'COMPLETED') {
    if (!next.player1_id || !next.player2_id) throw new Error('Both players must be assigned before a result can be recorded.')
    if (next.player1_score == null || next.player2_score == null) throw new Error('Both scores are required.')
    if (next.player1_score < 0 || next.player2_score < 0) throw new Error('Scores cannot be negative.')
    if (next.player1_score === next.player2_score) throw new Error('Draws are not permitted in this tournament.')
    next.winner_id = next.player1_score > next.player2_score ? next.player1_id : next.player2_id
    next.completed_at = prev?.status === 'COMPLETED' && prev.completed_at ? prev.completed_at : nowIso()
  } else {
    next.player1_score = null
    next.player2_score = null
    next.winner_id = null
    next.completed_at = null
  }

  if (next.player1_id && next.player1_id === next.player2_id) throw new Error('A player cannot play themselves.')
  const clash = state.matches.find(
    (m) => m.id !== next.id && m.round === next.round && m.match_number === next.match_number,
  )
  if (clash) throw new Error('A match with that round and match number already exists.')

  // Advancement: only when the winner actually changed.
  const winnerChanged = (prev?.winner_id ?? null) !== next.winner_id
  const target = winnerChanged ? advancementTarget(next.round, next.match_number) : null
  if (target) {
    const tm = state.matches.find((m) => m.round === target.round && m.match_number === target.match_number)
    if (tm) {
      const key = target.slot === 1 ? 'player1_id' : 'player2_id'
      if (tm[key] !== next.winner_id) {
        if (tm.status === 'COMPLETED') {
          throw new Error(
            `Cannot change this winner: the next match (${ROUND_LABEL[tm.round]} ${tm.match_number}) has already been played. Correct that result first.`,
          )
        }
        tm[key] = next.winner_id
      }
    }
  }

  const idx = state.matches.findIndex((m) => m.id === next.id)
  if (idx >= 0) state.matches[idx] = next
  else state.matches.push(next)
}

function blankMatch(partial: Partial<Match> & Pick<Match, 'round' | 'match_number'>): Match {
  return {
    id: uid(),
    player1_id: null,
    player2_id: null,
    player1_score: null,
    player2_score: null,
    winner_id: null,
    status: 'UPCOMING',
    scheduled_at: null,
    completed_at: null,
    created_at: nowIso(),
    ...partial,
  }
}

/* ------------------------------------------------------------------ demo seed */

function seed(): TournamentData {
  const names: [string, string, string][] = [
    ['Rohan Dongre', 'ROHAN', 'Real Madrid'],
    ['Player 02', 'P02', 'Manchester City'],
    ['Player 03', 'P03', 'Bayern Munich'],
    ['Player 04', 'P04', 'Arsenal'],
    ['Player 05', 'P05', 'Barcelona'],
    ['Player 06', 'P06', 'Inter'],
    ['Player 07', 'P07', 'PSG'],
    ['Player 08', 'P08', 'Liverpool'],
  ]
  const players: Player[] = names.map(([name, short_name, club], i) => ({
    id: uid(),
    name,
    short_name,
    club,
    avatar_url: null,
    created_at: new Date(Date.now() - (names.length - i) * 1000).toISOString(),
  }))
  const state: TournamentData = { players, matches: [], settings: { ...DEFAULT_SETTINGS } }

  const at = (days: number, hour: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(hour, 30, 0, 0)
    return d.toISOString()
  }
  const slots = [at(-1, 18), at(-1, 19), at(1, 18), at(1, 19), at(3, 19), at(3, 20), at(5, 20)]
  buildBracketSkeleton(players.map((p) => p.id)).forEach((s, i) => {
    state.matches.push(blankMatch({ ...s, scheduled_at: slots[i] }))
  })

  const result = (round: Match['round'], n: number, a: number, b: number) => {
    const m = state.matches.find((x) => x.round === round && x.match_number === n)!
    applyMatchWrite(state, { ...m, player1_score: a, player2_score: b, status: 'COMPLETED' }, m)
  }
  result('QUARTER_FINAL', 1, 3, 1)
  result('QUARTER_FINAL', 2, 1, 2)
  return state
}

/* ------------------------------------------------------------------ API */

export function createDemoApi(): TournamentApi {
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  // Changes made in another tab show up here too (storage events don't fire in the same tab).
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) emit()
  })

  const mutate = (fn: (s: TournamentData) => void) => {
    const state = structuredClone(load())
    fn(state) // throws on rule violations -> nothing is saved
    save(state)
    emit()
  }

  const assertUniqueName = (state: TournamentData, name: string, exceptId?: string) => {
    if (state.players.some((p) => p.id !== exceptId && normalizeName(p.name) === normalizeName(name)))
      throw new Error('A player with that name already exists.')
  }

  return {
    mode: 'demo',
    async fetchAll() {
      return structuredClone(load())
    },
    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },

    async createPlayer(input: PlayerInput) {
      mutate((s) => {
        assertUniqueName(s, input.name)
        s.players.push({ id: uid(), created_at: nowIso(), ...input })
      })
    },
    async updatePlayer(id, input) {
      mutate((s) => {
        assertUniqueName(s, input.name, id)
        const p = s.players.find((x) => x.id === id)
        if (!p) throw new Error('Player not found.')
        Object.assign(p, input)
      })
    },
    async deletePlayer(id) {
      mutate((s) => {
        for (const m of s.matches) {
          if (m.player1_id !== id && m.player2_id !== id && m.winner_id !== id) continue
          if (m.status === 'COMPLETED') throw new Error('This player has completed matches and cannot be deleted.')
          if (m.player1_id === id) m.player1_id = null
          if (m.player2_id === id) m.player2_id = null
        }
        s.players = s.players.filter((p) => p.id !== id)
      })
    },

    async createMatch(input: MatchInput) {
      mutate((s) => applyMatchWrite(s, blankMatch(input), null))
    },
    async updateMatch(id, patch) {
      mutate((s) => {
        const prev = s.matches.find((m) => m.id === id)
        if (!prev) throw new Error('Match not found.')
        applyMatchWrite(s, { ...prev, ...patch }, prev)
      })
    },
    async deleteMatch(id) {
      mutate((s) => {
        const m = s.matches.find((x) => x.id === id)
        if (m?.status === 'COMPLETED')
          throw new Error('Completed matches cannot be deleted. Correct the result, or reset the whole tournament.')
        s.matches = s.matches.filter((x) => x.id !== id)
      })
    },

    async submitResult(matchId, score1, score2) {
      if (!Number.isInteger(score1) || !Number.isInteger(score2)) throw new Error('Both scores are required.')
      if (score1 < 0 || score2 < 0) throw new Error('Scores cannot be negative.')
      if (score1 === score2) throw new Error('Draws are not permitted in this tournament.')
      mutate((s) => {
        const prev = s.matches.find((m) => m.id === matchId)
        if (!prev) throw new Error('Match not found.')
        if (prev.status === 'CANCELLED') throw new Error('This match was cancelled.')
        applyMatchWrite(s, { ...prev, player1_score: score1, player2_score: score2, status: 'COMPLETED' }, prev)
      })
    },

    async generateBracket(ids) {
      mutate((s) => {
        if (s.matches.length > 0)
          throw new Error('Fixtures already exist. Reset the tournament before generating a new bracket.')
        if (new Set(ids).size !== ids.length) throw new Error('The same player appears more than once.')
        buildBracketSkeleton(ids).forEach((sk) => s.matches.push(blankMatch(sk)))
      })
    },
    async resetTournament() {
      mutate((s) => {
        s.matches = []
      })
    },

    async updateSettings(settings) {
      mutate((s) => {
        s.settings = { ...settings }
      })
    },
  }
}

/** Wipe the demo and reseed it. */
export function resetDemoData() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ demo auth */

export function createDemoAuth(): AuthApi {
  const listeners = new Set<(s: AdminSession | null) => void>()
  const read = (): AdminSession | null => {
    try {
      return localStorage.getItem(AUTH_KEY) ? { userId: 'demo-admin', email: DEMO_ADMIN.email, isAdmin: true } : null
    } catch {
      return null
    }
  }
  return {
    async getSession() {
      return read()
    },
    async signIn(email, password) {
      const who = email.trim().toLowerCase()
      if ((who !== DEMO_ADMIN.email && who !== 'demo') || password !== DEMO_ADMIN.password)
        throw new Error('Incorrect username or password.')
      localStorage.setItem(AUTH_KEY, '1')
      const s = read()!
      listeners.forEach((l) => l(s))
      return s
    },
    async signOut() {
      localStorage.removeItem(AUTH_KEY)
      listeners.forEach((l) => l(null))
    },
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}
