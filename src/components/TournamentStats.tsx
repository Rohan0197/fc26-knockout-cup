import { motion } from 'framer-motion'
import { useTournament } from '../context/TournamentContext'
import { ROUND_LABEL } from '../lib/bracket'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { StatTilesSkeleton } from './ui/Skeletons'

function Tile({ label, children, i }: { label: string; children: React.ReactNode; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="panel px-4 py-4 sm:px-5 sm:py-5"
    >
      <div className="label text-[0.72rem] text-mute">{label}</div>
      <div className="mt-1.5 text-white">{children}</div>
    </motion.div>
  )
}

/** The 5-second summary: which round, how many players, how much is done, how much is left. */
export function TournamentStats() {
  const { players, tournament, status } = useTournament()
  if (status === 'loading') return <StatTilesSkeleton />

  const round = tournament.phase === 'COMPLETE' ? 'Completed' : tournament.currentRound ? ROUND_LABEL[tournament.currentRound] : 'Not started'

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Tile label="Current round" i={0}>
        <span className="display block truncate text-[1.9rem] leading-[1.05] sm:text-4xl">{round}</span>
      </Tile>
      <Tile label="Players" i={1}>
        <AnimatedNumber value={players.length} className="num text-4xl leading-none sm:text-5xl" />
      </Tile>
      <Tile label="Matches played" i={2}>
        <AnimatedNumber value={tournament.completed} className="num text-4xl leading-none sm:text-5xl" />
        <span className="num ml-1 text-xl text-mute">/ {tournament.totalMatches}</span>
      </Tile>
      <Tile label="Remaining" i={3}>
        <AnimatedNumber value={tournament.remaining} className="num text-4xl leading-none text-pitch sm:text-5xl" />
      </Tile>
    </div>
  )
}
