import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AdminSession } from '../types'
import { backend } from '../lib/api'

interface AuthContextValue {
  /** `loading` until the stored session has been checked. */
  loading: boolean
  session: AdminSession | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = backend!.auth
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<AdminSession | null>(null)

  useEffect(() => {
    let alive = true
    auth
      .getSession()
      .then((s) => alive && setSession(s))
      .catch(() => alive && setSession(null))
      .finally(() => alive && setLoading(false))
    const off = auth.onChange((s) => alive && setSession(s))
    return () => {
      alive = false
      off()
    }
  }, [auth])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setSession(await auth.signIn(email, password))
    },
    [auth],
  )
  const signOut = useCallback(async () => {
    await auth.signOut()
    setSession(null)
  }, [auth])

  const value = useMemo(() => ({ loading, session, signIn, signOut }), [loading, session, signIn, signOut])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}
