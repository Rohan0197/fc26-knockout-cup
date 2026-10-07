import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Browser client. It only ever holds the PUBLIC anon key - what a visitor (or admin) can do is
 * decided by Row Level Security in the database, never by this file. The service-role key must
 * never be placed in a VITE_ variable.
 */
export const supabase = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null

/** Demo (local sample data) is only ever available in development, or when explicitly enabled. */
export const isDemoAllowed =
  import.meta.env.DEV || (import.meta.env.VITE_ENABLE_DEMO as string | undefined) === 'true'
