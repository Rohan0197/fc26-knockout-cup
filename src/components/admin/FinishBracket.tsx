import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ShieldCheck, Shuffle, Swords } from 'lucide-react'
import { backend } from '../../lib/api'
import { ROUND_LABEL, ROUND_ORDER, isBracketMatch, planCompletion } from '../../lib/bracket'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'

const api = backend!.api

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * For a tournament that started with hand-made first-round fixtures: builds the rest of the bracket (and any first-round
 * fixtures still missing) AROUND what already exists. Existing fixtures and results are never changed.
 * Only shown while the bracket consists of its first round alone.
 */
export function FinishBracket() {
  const { matches, players, schemaReady } = useTournament()
  const run = useAdminAction()
  const [randomDraw, setRandomDraw] = useState(true)
  const [order, setOrder] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  const bracket = useMemo(() => matches.filter(isBracketMatch), [matches])
  const firstRound = ROUND_ORDER.find((r) => bracket.some((m) => m.round === r))
  const onlyFirstRound = Boolean(firstRound) && bracket.every((m) => m.round === firstRound) && firstRound !== 'FINAL'
  const existing = useMemo(() => bracket.filter((m) => m.round === firstRound), [bracket, firstRound])
  const played = existing.filter((m) => m.status === 'COMPLETED').length

  const unplaced = useMemo(() => {
    const placed = new Set(bracket.flatMap((m) => [m.player1_id, m.player2_id]).filter(Boolean))
    return players.filter((p) => !placed.has(p.id)).map((p) => p.id)
  }, [bracket, players])
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const name = (id: string | null) => (id ? (byId.get(id)?.name ?? '?') : 'TBD')

  // the order in which unpaired players are paired: the draw, or the list order
  const sequence = order && order.length === unplaced.length && order.every((id) => unplaced.includes(id)) ? order : unplaced

  const result = useMemo(() => {
    if (!onlyFirstRound) return null
    try {
      return { plan: planCompletion(existing, sequence), error: null as string | null }
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : 'These fixtures do not fit a bracket.' }
    }
  }, [onlyFirstRound, existing, sequence])

  if (!onlyFirstRound || !firstRound || !result) return null
  if (!schemaReady) {
    return (
      <section className="panel mb-6 border-pitch/30 p-5 sm:p-6">
        <div className="eyebrow mb-1 !text-[0.72rem]">Next step</div>
        <h2 className="display text-3xl text-white">Finish the bracket</h2>
        <p className="mt-2 max-w-2xl text-sm text-soft">
          Your bracket has {existing.length} {ROUND_LABEL[firstRound]} fixtures ({played} played) and no later rounds yet. After the one-time database
          upgrade this panel builds the remaining rounds around them without changing any fixture or result.
        </p>
        <p className="mt-3 text-sm text-warn">Waiting for the database upgrade (migration 003).</p>
      </section>
    )
  }

  const build = async () => {
    setBusy(true)
    await run(() => api.completeBracket(sequence), 'Bracket completed. Your existing fixtures and results were not changed.')
    setBusy(false)
  }

  return (
    <section className="panel mb-6 border-pitch/30 p-5 sm:p-6">
      <div className="eyebrow mb-1 !text-[0.72rem]">Next step</div>
      <h2 className="display text-3xl text-white">Finish the bracket</h2>
      <p className="mt-2 max-w-2xl text-sm text-soft">
        Right now the bracket only has its first round: <strong className="text-white">{existing.length}</strong> {ROUND_LABEL[firstRound]} fixtures
        ({played} played). This builds everything that is missing around them.
      </p>
      <p className="mt-2 flex items-start gap-2 text-sm text-pitch">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>Every fixture and result you have entered stays exactly as it is. Nothing is deleted or edited.</span>
      </p>

      {unplaced.length > 0 && (
        <div className="mt-5">
          <div className="label mb-2 text-[0.75rem] text-mute">
            {unplaced.length} player{unplaced.length === 1 ? ' is' : 's are'} not in any fixture yet
          </div>
          <div className="flex flex-wrap gap-1.5 text-sm text-soft">
            {unplaced.map((id) => (
              <span key={id} className="bg-white/[0.05] px-2 py-1 ring-1 ring-inset ring-white/10">{name(id)}</span>
            ))}
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-soft">
            <input type="checkbox" checked={randomDraw} onChange={(e) => { setRandomDraw(e.target.checked); setOrder(null) }} className="h-4 w-4 accent-[#2bff88]" />
            Random draw <span className="text-mute">(otherwise they are paired in the order listed: 1 v 2, 3 v 4…)</span>
          </label>
          <button className="btn btn-ghost mt-3" onClick={() => setOrder(randomDraw ? shuffle(unplaced) : unplaced)}>
            <Shuffle size={16} /> {order ? 'Redraw' : 'Draw pairings'}
          </button>
        </div>
      )}

      {result.error && (
        <div role="alert" className="mt-5 flex items-start gap-2 border-l-2 border-warn bg-warn/10 px-3 py-2.5 text-sm text-warn">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {result.error}{' '}
            <Link to="/admin/fixtures" className="underline">
              Open Fixtures
            </Link>
          </span>
        </div>
      )}

      {result.plan && (
        <div className="mt-5 space-y-5">
          <div>
            <div className="label mb-2 text-[0.75rem] text-mute">How the tournament will run</div>
            <ol className="divide-y divide-white/[0.06] border border-white/[0.08]">
              {result.plan.plan.map((r, i, all) => (
                <li key={r.round} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                  <span className="display w-40 text-xl text-white">{ROUND_LABEL[r.round]}</span>
                  <span className="num text-lg text-pitch">{r.matches} {r.matches === 1 ? 'match' : 'matches'}</span>
                  {i === 0 && <span className="text-sm text-mute">{existing.length} existing{result.plan!.newPairs.length ? ` + ${result.plan!.newPairs.length} new` : ''}</span>}
                  {r.byes > 0 && (
                    <span className="text-sm text-warn">
                      {r.byes} {r.byes === 1 ? 'player skips' : 'players skip'} this round (bye): the winner of the last {ROUND_LABEL[all[i - 1].round]} match
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-mute">{result.plan.totalMatches} matches in total, always players minus one.</p>
          </div>

          {result.plan.newPairs.length > 0 && (
            <div>
              <div className="label mb-2 text-[0.75rem] text-mute">New {ROUND_LABEL[firstRound]} fixtures</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.plan.newPairs.map((p) => (
                  <div key={p.match_number} className="flex items-center gap-3 bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/10">
                    <span className="num w-8 text-lg text-mute">M{p.match_number}</span>
                    <span className="display min-w-0 flex-1 truncate text-xl text-white">
                      {name(p.player1_id)} <span className="text-mute">vs</span> {name(p.player2_id)}
                    </span>
                  </div>
                ))}
              </div>
              {result.plan.carriedPlayer && (
                <p className="mt-2 text-sm text-warn">With an odd number of players, <strong>{name(result.plan.carriedPlayer)}</strong> has no opponent in {ROUND_LABEL[firstRound]} and starts in the next round.</p>
              )}
            </div>
          )}

          <button className="btn btn-primary" onClick={build} disabled={busy}>
            <Swords size={16} /> {busy ? 'Building…' : 'Build the remaining rounds'}
          </button>
        </div>
      )}
    </section>
  )
}
