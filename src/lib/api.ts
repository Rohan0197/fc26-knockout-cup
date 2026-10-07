import { isDemoAllowed, isSupabaseConfigured, supabase } from './supabase'
import { createSupabaseApi, createSupabaseAuth, type AuthApi, type TournamentApi } from './queries'
import { createDemoApi, createDemoAuth } from './demoStore'

/**
 * Backend selection:
 *   1. Supabase env vars present  -> real backend (production path).
 *   2. Otherwise, in dev only     -> local demo store with clearly-labelled sample data.
 *   3. Otherwise                  -> `null`; the app renders a setup screen instead of fake data.
 */
export const backend: { api: TournamentApi; auth: AuthApi } | null = supabase
  ? { api: createSupabaseApi(supabase), auth: createSupabaseAuth(supabase) }
  : isDemoAllowed
    ? { api: createDemoApi(), auth: createDemoAuth() }
    : null

export const needsSetup = !isSupabaseConfigured && !isDemoAllowed
