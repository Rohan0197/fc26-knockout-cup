import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { ArrowRight, Crown } from 'lucide-react'
import { useTournament } from '../context/TournamentContext'
import { ROUND_LABEL } from '../lib/bracket'
import { TournamentStats } from './TournamentStats'
import { PlayerAvatar } from './ui/PlayerAvatar'

const EASE = [0.22, 1, 0.36, 1] as const

export function Hero() {
  const { settings, tournament, standings, status } = useTournament()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const titleY = useTransform(scrollYProgress, [0, 1], [0, 70])
  const ghostY = useTransform(scrollYProgress, [0, 1], [0, 150])
  const phone = useMediaQuery('(max-width: 767px)')
  const reduced = useReducedMotion()
  const still = phone || Boolean(reduced)

  const words = settings.name.trim().split(/\s+/)
  const split = Math.ceil(words.length / 2)
  const line1 = words.slice(0, split).join(' ')
  const line2 = words.slice(split).join(' ')

  const phaseLabel =
    tournament.phase === 'LIVE' ? 'Live tournament' : tournament.phase === 'COMPLETE' ? 'Tournament complete' : 'Fixtures pending'
  const roundLine =
    tournament.phase === 'COMPLETE'
      ? 'Champion crowned'
      : tournament.currentRound
        ? ROUND_LABEL[tournament.currentRound]
        : 'Awaiting kick-off'

  const leader = standings[0]
  const hasLeader = leader && leader.points > 0
  const spotlight = tournament.champion ?? (hasLeader ? leader.player : null)

  return (
    <section ref={ref} className="relative mb-14 sm:mb-20">
      {/* moving light bar */}
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-[420px] overflow-hidden" aria-hidden>
        <span className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent [animation:sweep_9s_ease-in-out_infinite]" />
      </div>

      <div className="grid items-center gap-10 py-6 lg:grid-cols-[1.35fr_1fr] lg:py-10">
        <motion.div style={still ? undefined : { y: titleY }} className="relative">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mb-6 inline-flex items-center gap-3 border border-pitch/35 bg-pitch/[0.08] py-1.5 pl-3 pr-4"
          >
            {tournament.phase === 'LIVE' ? <span className="live-dot" /> : <span className="h-2 w-2 rounded-full bg-mute" />}
            <span className="label text-[0.82rem] tracking-[0.28em] text-pitch">{phaseLabel}</span>
            <span className="h-3 w-px bg-white/20" />
            <span className="label text-[0.82rem] tracking-[0.2em] text-white">{roundLine}</span>
          </motion.div>

          <div className="relative">
            <motion.span
              style={still ? undefined : { y: ghostY }}
              aria-hidden
              className="display pointer-events-none absolute -left-4 -top-16 select-none text-[16rem] leading-none text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.06)] sm:text-[22rem]"
            >
              26
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
              className="display relative text-[3.6rem] text-white xs:text-[4.6rem] sm:text-[7rem] lg:text-[8.4rem]"
              style={{ textShadow: '0 10px 60px rgba(0,0,0,0.6)' }}
            >
              {line1}
              {line2 && (
                <span className="block bg-gradient-to-r from-pitch via-[#8dffc0] to-white bg-clip-text text-transparent">{line2}</span>
              )}
            </motion.h1>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="label mt-5 flex items-center gap-4 text-base tracking-[0.42em] text-soft sm:text-xl"
          >
            <span className="h-px w-10 bg-pitch" />
            {settings.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to="/bracket" className="btn btn-primary">
              View bracket <ArrowRight size={17} />
            </Link>
            <Link to="/fixtures" className="btn btn-ghost">
              Fixtures
            </Link>
          </motion.div>
        </motion.div>

        {/* badge + spotlight */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,rgba(43,255,136,0.16),transparent)]" aria-hidden />
          <div className="panel panel-both relative overflow-hidden px-6 py-8 text-center">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.03)_0_2px,transparent_2px_24px)]" aria-hidden />
            <div className="relative">
              {status === 'loading' ? (
                <div className="skeleton mx-auto h-14 w-3/4" />
              ) : spotlight ? (
                <div className="block">
                  <div className="label flex items-center justify-center gap-2 text-[0.78rem] tracking-[0.3em] text-gold">
                    <Crown size={13} /> {tournament.champion ? 'Champion' : 'Tournament leader'}
                  </div>
                  <div className="mt-5 flex items-center justify-center gap-5">
                    <PlayerAvatar player={spotlight} size={76} />
                    <div className="text-left">
                      <div className="display text-4xl text-white sm:text-5xl">{spotlight.name}</div>
                      <div className="num text-xl text-soft">
                        {standings.find((s) => s.player.id === spotlight.id)?.wins ?? 0}W ·{' '}
                        {standings.find((s) => s.player.id === spotlight.id)?.losses ?? 0}L
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="label text-[0.78rem] tracking-[0.3em] text-mute">Tournament leader</div>
                  <div className="display mt-2 text-2xl text-soft">Decided on the pitch</div>
                </div>
              )}
            </div>
            <div className="label relative mt-7 border-t border-white/10 pt-4 text-[0.7rem] tracking-[0.3em] text-mute">
              Presented by <span className="text-soft">{settings.organizer}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <TournamentStats />
    </section>
  )
}
