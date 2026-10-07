export type Round = 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'FINAL'
export type MatchStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED'

export interface Player {
  id: string
  name: string
  short_name: string | null
  avatar_url: string | null
  club: string | null
  created_at: string
}

export interface Match {
  id: string
  round: Round
  match_number: number
  player1_id: string | null
  player2_id: string | null
  player1_score: number | null
  player2_score: number | null
  winner_id: string | null
  status: MatchStatus
  scheduled_at: string | null
  completed_at: string | null
  created_at: string
}

export interface TournamentSettings {
  name: string
  subtitle: string
  organizer: string
}

export type PlayerStatus = 'CHAMPION' | 'ACTIVE' | 'ELIMINATED' | 'WAITING'

/** Derived from completed matches - never stored, never edited by hand. */
export interface Standing {
  player: Player
  rank: number
  played: number
  wins: number
  losses: number
  points: number
  winPct: number
  status: PlayerStatus
}

export type TournamentPhase = 'PENDING' | 'LIVE' | 'COMPLETE'

export interface TournamentState {
  phase: TournamentPhase
  currentRound: Round | null
  totalMatches: number
  completed: number
  remaining: number
  champion: Player | null
}

export interface PlayerInput {
  name: string
  short_name: string | null
  avatar_url: string | null
  club: string | null
}

export interface MatchInput {
  round: Round
  match_number: number
  player1_id: string | null
  player2_id: string | null
  scheduled_at: string | null
  status: MatchStatus
}

export interface AdminSession {
  userId: string
  email: string
  isAdmin: boolean
}
