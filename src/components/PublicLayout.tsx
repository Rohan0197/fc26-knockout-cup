import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { StadiumBackground } from './StadiumBackground'
import { LiveUpdateIndicator } from './LiveUpdateIndicator'
import { DemoBanner } from './DemoBanner'
import { useTournament } from '../context/TournamentContext'
import { AlertTriangle } from 'lucide-react'

export function PublicLayout() {
  const { pathname } = useLocation()
  const { status, error } = useTournament()

  return (
    <div className="relative flex min-h-dvh flex-col">
      <StadiumBackground />
      <DemoBanner />
      <Navbar />
      <main className="mx-auto w-full max-w-[1280px] 2xl:max-w-[1440px] flex-1 px-4 pb-8 pt-24 sm:px-6 sm:pt-28">
        {status === 'error' ? (
          <div className="panel flex items-start gap-4 p-6" role="alert">
            <AlertTriangle className="mt-1 shrink-0 text-warn" />
            <div>
              <h2 className="display text-3xl">Can't reach the tournament</h2>
              <p className="mt-2 text-sm text-mute">{error}</p>
            </div>
          </div>
        ) : (
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        )}
      </main>
      <Footer />
      <LiveUpdateIndicator />
    </div>
  )
}
