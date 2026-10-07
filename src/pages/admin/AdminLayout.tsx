import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  ClipboardCheck,
  ExternalLink,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTournament } from '../../context/TournamentContext'
import { ToastProvider } from '../../components/ui/Toast'
import { TournamentMark } from '../../components/TournamentMark'
import { DemoBanner } from '../../components/DemoBanner'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/players', label: 'Players', icon: Users },
  { to: '/admin/fixtures', label: 'Fixtures', icon: CalendarDays },
  { to: '/admin/results', label: 'Results', icon: ClipboardCheck },
  { to: '/admin/bracket', label: 'Bracket', icon: GitBranch },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout() {
  const { loading, session, signOut } = useAuth()
  const { settings } = useTournament()
  const { pathname } = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-950" aria-busy="true">
        <div className="skeleton h-10 w-48" />
      </div>
    )
  }

  // Not signed in -> login. (The database enforces the real rules; this is just the UX gate.)
  if (!session) return <Navigate to="/admin/login" replace />

  if (!session.isAdmin) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-950 px-4">
        <div className="panel panel-both max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto text-warn" size={34} />
          <h1 className="display mt-4 text-4xl text-white">Not an administrator</h1>
          <p className="mt-3 text-sm leading-relaxed text-mute">
            You're signed in as <span className="text-white">{session.email}</span>, but this account hasn't been granted admin
            access. Ask the tournament owner to add it to the <code className="text-soft">admins</code> table.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/" className="btn btn-ghost btn-sm">
              Back to site
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className="relative min-h-dvh bg-ink-950">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(50%_40%_at_80%_0%,rgba(43,255,136,0.06),transparent)]" aria-hidden />
        <DemoBanner />

        <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] border-b border-white/[0.07] bg-ink-950/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1280px] 2xl:max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <TournamentMark size={32} />
              <span className="display hidden truncate text-xl text-white sm:block">{settings.name}</span>
              <span className="label bg-pitch px-2 py-[3px] text-[0.68rem] tracking-[0.22em] text-ink-950">Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/" className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> <span className="hidden sm:inline">View site</span>
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={() => void signOut()} title={session.email}>
                <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <div className="relative mx-auto flex max-w-[1280px] 2xl:max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:py-8">
          <nav className="hide-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0" aria-label="Admin">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `label relative flex shrink-0 items-center gap-3 px-4 py-3 text-[0.9rem] transition-colors ${
                    isActive ? 'bg-white/[0.07] text-white' : 'text-mute hover:bg-white/[0.04] hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="admin-nav"
                        className="absolute inset-y-0 left-0 w-[3px] bg-pitch"
                        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                      />
                    )}
                    <Icon size={17} className={isActive ? 'text-pitch' : ''} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <main className="min-w-0 flex-1">
            <motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
