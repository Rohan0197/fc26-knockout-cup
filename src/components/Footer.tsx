import { Link } from 'react-router-dom'
import { useTournament } from '../context/TournamentContext'

export function Footer() {
  const { settings } = useTournament()
  return (
    <footer className="relative mt-24 border-t border-white/[0.07] bg-ink-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] 2xl:max-w-[1440px] flex-col items-start justify-between gap-4 px-4 py-7 sm:flex-row sm:items-center sm:px-6">
        <div>
          <div className="display text-2xl text-white">{settings.name}</div>
          <div className="label mt-1 text-[0.72rem] text-mute">Powered by {settings.organizer}</div>
        </div>
        <Link to="/admin" className="label text-[0.8rem] text-mute transition-colors hover:text-pitch">
          Admin Login →
        </Link>
      </div>
    </footer>
  )
}
