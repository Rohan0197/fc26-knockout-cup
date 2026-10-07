import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTournament } from '../../context/TournamentContext'
import { DEMO_ADMIN } from '../../lib/demoStore'
import { TournamentMark } from '../../components/TournamentMark'
import { Field } from '../../components/admin/Field'

export default function AdminLogin() {
  const { session, loading, signIn } = useAuth()
  const { mode, settings } = useTournament()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/admin" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center bg-ink-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(43,255,136,0.10),transparent)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <Link to="/" className="label mb-5 inline-flex items-center gap-2 text-[0.8rem] text-mute transition-colors hover:text-pitch">
          <ArrowLeft size={14} /> Back to tournament
        </Link>

        <form onSubmit={submit} className="panel panel-both p-7 sm:p-9" noValidate>
          <div className="flex items-center gap-4">
            <TournamentMark size={46} />
            <div>
              <div className="eyebrow !text-[0.7rem]">Organiser access</div>
              <div className="display text-3xl text-white">Admin sign in</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-mute">Restricted to tournament administrators of {settings.name}.</p>

          <div className="mt-6 space-y-4">
            <Field label="Email">
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error)}
                autoFocus
              />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error)}
              />
            </Field>
          </div>

          {error && (
            <div role="alert" className="mt-4 border-l-2 border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy || loading}>
            <Lock size={15} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {mode === 'demo' && (
            <div className="mt-5 border border-warn/40 bg-warn/[0.07] px-3 py-2.5 text-xs leading-relaxed text-warn">
              <strong className="label">Development demo</strong> — no Supabase project connected. Use{' '}
              <code className="text-white">{DEMO_ADMIN.email}</code> / <code className="text-white">{DEMO_ADMIN.password}</code>.
            </div>
          )}
        </form>
      </motion.div>
    </div>
  )
}
