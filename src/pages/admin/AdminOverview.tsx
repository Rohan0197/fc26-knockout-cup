import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { useTournament } from '../../context/TournamentContext'
import { ROUND_LABEL } from '../../lib/bracket'
import { recentResults, upcomingMatches } from '../../lib/calculations'
import { fmtKickoff } from '../../utils/format'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { UpgradeNotice } from '../../components/admin/UpgradeNotice'

function Tile({ label, value, text, accent }: { label: string; value?: number; text?: string; accent?: boolean }) {
  return (
    <div className="panel px-4 py-4 sm:px-5">
      <div className="label text-[0.72rem] text-mute">{label}</div>
      <div className={`mt-1.5 ${accent ? 'text-pitch' : 'text-white'}`}>
        {value !== undefined ? (
          <AnimatedNumber value={value} className="num text-5xl leading-none" />
        ) : (
          <span className="display text-3xl leading-none">{text}</span>
        )}
      </div>
    </div>
  )
}

export default function AdminOverview() {
  const { players, matches, tournament, standings, status } = useTournament()
  const byId = new Map(players.map((p) => [p.id, p]))
  const recent = recentResults(matches, 5)
  const next = upcomingMatches(matches, 5)
  const upcomingCount = matches.filter((m) => m.status === 'UPCOMING' || m.status === 'LIVE').length

  const steps = [
    { done: players.length > 0, label: 'Add the players', to: '/admin/players' },
    { done: matches.length > 0, label: 'Generate the bracket (or add fixtures by hand)', to: '/admin/bracket' },
    { done: tournament.completed > 0, label: 'Enter match results as they finish', to: '/admin/results' },
  ]

  const roundText =
    tournament.phase === 'COMPLETE' ? 'Completed' : tournament.currentRound ? ROUND_LABEL[tournament.currentRound] : 'Not started'

  return (
    <>
      <AdminPageHeader title="Overview" subtitle="Everything here is calculated from the match results you enter — nothing is edited by hand." />

      <UpgradeNotice />

      {status === 'loading' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          <Tile label="Total players" value={players.length} />
          <Tile label="Total matches" value={matches.length} />
          <Tile label="Completed" value={tournament.completed} accent />
          <Tile label="Upcoming" value={upcomingCount} />
          <Tile label="Current round" text={roundText} />
        </div>
      )}

      {steps.some((s) => !s.done) && (
        <div className="panel mt-6 p-5">
          <div className="eyebrow mb-3 !text-[0.72rem]">Getting started</div>
          <ol className="space-y-2.5">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                {s.done ? <CheckCircle2 size={18} className="text-pitch" /> : <Circle size={18} className="text-mute" />}
                <Link to={s.to} className={s.done ? 'text-mute line-through' : 'text-white hover:text-pitch'}>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-2xl text-white">Recent results</h2>
            <Link to="/admin/results" className="label text-[0.78rem] text-mute hover:text-pitch">
              Results →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-mute">No results yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {recent.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="label text-[0.68rem] text-mute">
                      {ROUND_LABEL[m.round]} · M{m.match_number}
                    </div>
                    <div className="display truncate text-xl text-white">
                      <span className={m.winner_id === m.player1_id ? 'text-pitch' : ''}>{byId.get(m.player1_id ?? '')?.name}</span>
                      <span className="num mx-2 text-soft">
                        {m.player1_score}–{m.player2_score}
                      </span>
                      <span className={m.winner_id === m.player2_id ? 'text-pitch' : ''}>{byId.get(m.player2_id ?? '')?.name}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-2xl text-white">Up next</h2>
            <Link to="/admin/fixtures" className="label text-[0.78rem] text-mute hover:text-pitch">
              Fixtures →
            </Link>
          </div>
          {next.length === 0 ? (
            <p className="py-6 text-center text-sm text-mute">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {next.map((m) => (
                <li key={m.id} className="py-3">
                  <div className="label text-[0.68rem] text-mute">
                    {ROUND_LABEL[m.round]} · M{m.match_number} · {fmtKickoff(m.scheduled_at)}
                  </div>
                  <div className="display truncate text-xl text-white">
                    {byId.get(m.player1_id ?? '')?.name} <span className="text-mute">vs</span> {byId.get(m.player2_id ?? '')?.name}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {standings.length > 0 && standings[0].points > 0 && (
        <p className="mt-6 text-sm text-mute">
          Current leader: <span className="text-white">{standings[0].player.name}</span> ({standings[0].wins}W–{standings[0].losses}L)
        </p>
      )}
    </>
  )
}
