import type { SupabaseClient, User } from '@supabase/supabase-js'
import type {
  AdminSession,
  Match,
  MatchInput,
  Player,
  PlayerInput,
  TournamentSettings,
} from '../types'

export interface TournamentData {
  players: Player[]
  matches: Match[]
  settings: TournamentSettings
}

/** Everything the UI needs from a backend. Implemented by Supabase (real) and the local demo store. */
export interface TournamentApi {
  mode: 'supabase' | 'demo'
  fetchAll(): Promise<TournamentData>
  /** Calls `onChange` (debounced) whenever players / matches / settings change anywhere. */
  subscribe(onChange: () => void): () => void
  createPlayer(input: PlayerInput): Promise<void>
  updatePlayer(id: string, input: PlayerInput): Promise<void>
  deletePlayer(id: string): Promise<void>
  createMatch(input: MatchInput): Promise<void>
  updateMatch(id: string, patch: Partial<MatchInput>): Promise<void>
  deleteMatch(id: string): Promise<void>
  /** Enter or correct a result. The database derives the winner and advances the bracket. */
  submitResult(matchId: string, score1: number, score2: number): Promise<void>
  generateBracket(orderedPlayerIds: string[]): Promise<void>
  resetTournament(): Promise<void>
  updateSettings(settings: TournamentSettings): Promise<void>
}

export interface AuthApi {
  getSession(): Promise<AdminSession | null>
  signIn(email: string, password: string): Promise<AdminSession>
  signOut(): Promise<void>
  onChange(cb: (session: AdminSession | null) => void): () => void
}

// -----------------------------------------------------------------------------------------
// Supabase implementation
// -----------------------------------------------------------------------------------------

type DbError = { message: string; code?: string; details?: string | null } | null

function throwIfError(error: DbError): void {
  if (!error) return
  if (error.code === '23505') {
    if (error.message.includes('players_name_unique')) throw new Error('A player with that name already exists.')
    if (error.message.includes('matches_round_match_number_key'))
      throw new Error('A match with that round and match number already exists.')
    throw new Error('That record already exists.')
  }
  if (error.code === '42501' || /row-level security/i.test(error.message))
    throw new Error('You do not have permission to do that. Sign in as an administrator.')
  throw new Error(error.message)
}

export function createSupabaseApi(sb: SupabaseClient): TournamentApi {
  return {
    mode: 'supabase',

    async fetchAll() {
      const [players, matches, settings] = await Promise.all([
        sb.from('players').select('*').order('created_at', { ascending: true }),
        sb.from('matches').select('*').order('match_number', { ascending: true }),
        sb.from('tournament_settings').select('name, subtitle, organizer').eq('id', 1).maybeSingle(),
      ])
      throwIfError(players.error)
      throwIfError(matches.error)
      throwIfError(settings.error)
      return {
        players: (players.data ?? []) as Player[],
        matches: (matches.data ?? []) as Match[],
        settings: (settings.data as TournamentSettings | null) ?? {
          name: 'FC 26 Knockout Cup',
          subtitle: 'The Road to the Final',
          organizer: 'IT Committee, IIM Bodh Gaya',
        },
      }
    },

    subscribe(onChange) {
      let timer: ReturnType<typeof setTimeout> | undefined
      // One admin action touches several rows (result + advancement) - coalesce into one refetch.
      const ping = () => {
        clearTimeout(timer)
        timer = setTimeout(onChange, 250)
      }
      const channel = sb
        .channel('tournament-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, ping)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, ping)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_settings' }, ping)
        .subscribe()
      return () => {
        clearTimeout(timer)
        void sb.removeChannel(channel)
      }
    },

    async createPlayer(input) {
      const { error } = await sb.from('players').insert(input)
      throwIfError(error)
    },
    async updatePlayer(id, input) {
      const { error } = await sb.from('players').update(input).eq('id', id)
      throwIfError(error)
    },
    async deletePlayer(id) {
      const { error } = await sb.from('players').delete().eq('id', id)
      throwIfError(error)
    },

    async createMatch(input) {
      const { error } = await sb.from('matches').insert(input)
      throwIfError(error)
    },
    async updateMatch(id, patch) {
      const { error } = await sb.from('matches').update(patch).eq('id', id)
      throwIfError(error)
    },
    async deleteMatch(id) {
      const { error } = await sb.from('matches').delete().eq('id', id)
      throwIfError(error)
    },

    async submitResult(matchId, score1, score2) {
      const { error } = await sb.rpc('submit_match_result', {
        p_match_id: matchId,
        p_player1_score: score1,
        p_player2_score: score2,
      })
      throwIfError(error)
    },

    async generateBracket(ids) {
      const { error } = await sb.rpc('generate_bracket', { p_player_ids: ids })
      throwIfError(error)
    },
    async resetTournament() {
      const { error } = await sb.rpc('reset_tournament')
      throwIfError(error)
    },

    async updateSettings(s) {
      const { error } = await sb
        .from('tournament_settings')
        .update({ ...s, updated_at: new Date().toISOString() })
        .eq('id', 1)
      throwIfError(error)
    },
  }
}

async function toAdminSession(sb: SupabaseClient, user: User): Promise<AdminSession> {
  // RLS only lets a user see their own row, so this is a safe "am I an admin?" check.
  const { data } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return { userId: user.id, email: user.email ?? '', isAdmin: Boolean(data) }
}

export function createSupabaseAuth(sb: SupabaseClient): AuthApi {
  return {
    async getSession() {
      const { data } = await sb.auth.getSession()
      return data.session ? toAdminSession(sb, data.session.user) : null
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message)
      return toAdminSession(sb, data.user)
    },
    async signOut() {
      await sb.auth.signOut()
    },
    onChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        // Defer: supabase-js forbids awaiting other supabase calls inside this callback.
        setTimeout(() => {
          if (!session) cb(null)
          else void toAdminSession(sb, session.user).then(cb)
        }, 0)
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
