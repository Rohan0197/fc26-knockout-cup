import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Menu, X } from 'lucide-react'
import { useTournament } from '../context/TournamentContext'
import { TournamentMark } from './TournamentMark'

const LINKS = [
  { to: '/', label: 'Tournament', end: true },
  { to: '/standings', label: 'Standings' },
  { to: '/fixtures', label: 'Fixtures' },
  { to: '/bracket', label: 'Bracket' },
  { to: '/players', label: 'Players' },
]

export function Navbar() {
  const { settings } = useTournament()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-300 ${
        scrolled || open ? 'border-b border-white/[0.07] bg-ink-950/80 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] 2xl:max-w-[1440px] items-center justify-between px-4 sm:h-[72px] sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={`${settings.name} home`}>
          <TournamentMark size={36} />
          <span className="display truncate text-xl text-white sm:text-2xl">{settings.name}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="relative px-4 py-2">
              {({ isActive }) => (
                <>
                  <span
                    className={`label text-[0.95rem] transition-colors ${
                      isActive ? 'text-white' : 'text-mute hover:text-white'
                    }`}
                  >
                    {l.label}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-4 -bottom-[1px] h-[3px] bg-pitch shadow-[0_0_14px_rgba(43,255,136,0.7)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/admin" className="btn btn-ghost btn-sm hidden lg:inline-flex">
            <Lock size={14} /> Admin
          </Link>
          <button
            className="grid h-11 w-11 place-items-center text-white lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden lg:hidden"
          >
            <div className="mx-auto flex max-w-[1280px] 2xl:max-w-[1440px] flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1 sm:px-6">
              {LINKS.map((l, i) => (
                <motion.div
                  key={l.to}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04 }}
                >
                  <NavLink
                    to={l.to}
                    end={l.end}
                    className={({ isActive }) =>
                      `display flex items-center justify-between border-b border-white/[0.06] py-3.5 text-3xl ${
                        isActive ? 'text-pitch' : 'text-white'
                      }`
                    }
                  >
                    {l.label}
                  </NavLink>
                </motion.div>
              ))}
              <Link to="/admin" className="btn btn-ghost mt-5">
                <Lock size={15} /> Admin
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
