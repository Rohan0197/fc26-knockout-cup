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
  /**
   * false while the database has not had migration 003 yet. Every feature that needs it switches itself off, so the site
   * keeps working exactly as before on an un-upgraded database.
   */
  schemaUpgraded: boolean
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
  /** An extra match between any two players (rematches etc.); numbered automatically. Unlimited. */
  createExtraMatch(player1Id: string, player2Id: string, scheduledAt: string | null): Promise<void>
  updateMatch(id: string, patch: Partial<MatchInput>): Promise<void>
  deleteMatch(id: string): Promise<void>
  /** Enter or correct a result. The database derives the winner and advances the bracket. */
  submitResult(matchId: string, score1: number, score2: number): Promise<void>
  generateBracket(orderedPlayerIds: string[]): Promise<void>
  /** Finish a bracket around first-round fixtures that already exist; pairs the given unplaced players. Nothing existing is changed. */
  completeBracket(unplacedPlayerIds: string[]): Promise<void>
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
  if (error.code === '23503' && /next_match_id/.test(error.message))
    throw new Error("Other matches in the bracket feed into this one, so it can't be deleted. Reset the tournament to rebuild the bracket.")
  if (/permission denied/i.test(error.message))
    throw new Error(
      'The database refused access (permission denied). Run section 8b "Data API privileges" of supabase/schema.sql in the Supabase SQL editor.',
    )
  if (error.code === '42501' || /row-level security/i.test(error.message))
    throw new Error('You do not have permission to do that. Sign in as an administrator.')
  throw new Error(error.message)
}

export function createSupabaseApi(sb: SupabaseClient): TournamentApi {
  let upgraded = true // learned from the first fetch
  const needsUpgrade = () => new Error('This needs the one-time database upgrade (migration 003) first. Everything else keeps working meanwhile.')
  return {
    mode: 'supabase',

    async fetchAll() {
      const [players, matches, settingsFull] = await Promise.all([
        sb.from('players').select('*').order('created_at', { ascending: true }),
        sb.from('matches').select('*').order('match_number', { ascending: true }),
        sb.from('tournament_settings').select('name, subtitle, organizer, advancement_mode').eq('id', 1).maybeSingle(),
      ])
      // Database not upgraded yet (no advancement_mode column): keep the public site working, old behaviour = automatic.
      // We do not rely on the exact error code: if the full query fails but the plain one works, the only difference
      // between them is the new column, so the database simply has not been upgraded.
      let settings = settingsFull as unknown as { data: Partial<TournamentSettings> | null; error: DbError }
      upgraded = true
      if (settingsFull.error) {
        const legacy = await sb.from('tournament_settings').select('name, subtitle, organizer').eq('id', 1).maybeSingle()
        if (!legacy.error) {
          upgraded = false
          settings = { error: null, data: legacy.data ? { ...(legacy.data as Partial<TournamentSettings>), advancement_mode: 'AUTO' } : null }
        }
      }
      throwIfError(players.error)
      throwIfError(matches.error)
      throwIfError(settings.error)
      return {
        schemaUpgraded: upgraded,
        players: (players.data ?? []) as Player[],
        matches: (matches.data ?? []) as Match[],
        settings: (settings.data as TournamentSettings | null) ?? {
          name: 'FC 26 Knockout Cup',
          subtitle: 'The Road to the Final',
          organizer: 'IT Committee, IIM Bodh Gaya',
          advancement_mode: upgraded ? 'MANUAL' : 'AUTO',
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
    async createExtraMatch(player1Id, player2Id, scheduledAt) {
      if (!upgraded) throw needsUpgrade()
      const { error } = await sb.rpc('create_extra_match', {
        p_player1_id: player1Id,
        p_player2_id: player2Id,
        p_scheduled_at: scheduledAt,
      })
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
    async completeBracket(ids) {
      if (!upgraded) throw needsUpgrade()
      const { error } = await sb.rpc('complete_bracket', { p_unplaced_player_ids: ids })
      throwIfError(error)
    },
    async resetTournament() {
      const { error } = await sb.rpc('reset_tournament')
      throwIfError(error)
    },

    async updateSettings(s) {
      // Before the upgrade the column does not exist: saving branding must never try to write it.
      const { advancement_mode, ...branding } = s
      const payload = upgraded ? { ...branding, advancement_mode } : branding
      const { error } = await sb
        .from('tournament_settings')
        .update({ ...payload, updated_at: new Date().toISOString() })
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

/**
 * Supabase signs people in with an email address. To let admins use a plain username, a login
 * without an "@" is mapped to `<username>@<domain>`. Create the Supabase user with that exact
 * address (Auto Confirm User on - no email is ever sent). Domain is configurable.
 */
export function toLoginEmail(input: string): string {
  const v = input.trim().toLowerCase()
  if (v.includes('@')) return v
  const domain = (import.meta.env.VITE_ADMIN_EMAIL_DOMAIN as string | undefined)?.trim() || 'example.com'
  return `${v}@${domain}`
}

export function createSupabaseAuth(sb: SupabaseClient): AuthApi {
  return {
    async getSession() {
      const { data } = await sb.auth.getSession()
      return data.session ? toAdminSession(sb, data.session.user) : null
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: toLoginEmail(email), password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Incorrect username or password.' : error.message)
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
