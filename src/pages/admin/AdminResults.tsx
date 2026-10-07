import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, ClipboardCheck, Pencil, Trophy } from 'lucide-react'
import type { Match, Player } from '../../types'
import { backend } from '../../lib/api'
import { ROUND_LABEL, advancementTarget, compareMatches } from '../../lib/bracket'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'
import { fmtKickoff, pad2 } from '../../utils/format'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PlayerAvatar } from '../../components/ui/PlayerAvatar'
import { StatusPill } from '../../components/ui/StatusPill'

const api = backend!.api
const SCORE = /^\d{1,2}$/

function ResultModal({ match, p1, p2, onClose }: { match: Match; p1: Player; p2: Player; onClose: () => void }) {
  const { matches } = useTournament()
  const run = useAdminAction()
  const correcting = match.status === 'COMPLETED'
  const [a, setA] = useState(match.player1_score?.toString() ?? '')
  const [b, setB] = useState(match.player2_score?.toString() ?? '')
  const [confirming, setConfirming] = useState(false)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)

  const aOk = SCORE.test(a.trim())
  const bOk = SCORE.test(b.trim())
  const sa = aOk ? Number(a) : null
  const sb = bOk ? Number(b) : null

  let error: string | null = null
  if (a.trim() === '' || b.trim() === '') error = tried ? 'Enter a score for both players.' : null
  else if (!aOk || !bOk) error = 'Scores must be whole numbers from 0 to 99.'
  else if (sa === sb) error = 'Draws are not permitted in this tournament.'

  const winner = sa !== null && sb !== null && sa !== sb ? (sa > sb ? p1 : p2) : null
  const previousWinnerId = correcting ? match.winner_id : null
  const winnerChanges = Boolean(correcting && winner && winner.id !== previousWinnerId)

  // Mirror the database rule: a winner can't change once the next match has been played.
  const target = advancementTarget(match.round, match.match_number)
  const nextMatch = target ? matches.find((m) => m.round === target.round && m.match_number === target.match_number) : undefined
  const blockedByNext = Boolean(winnerChanges && nextMatch?.status === 'COMPLETED')

  const submit = async () => {
    setTried(true)
    if (sa === null || sb === null || sa === sb || blockedByNext) return
    if (correcting && !confirming) {
      setConfirming(true)
      return
    }
    setBusy(true)
    const ok = await run(() => api.submitResult(match.id, sa, sb), correcting ? 'Result corrected. Standings and bracket updated.' : 'Result saved. Standings and bracket updated.')
    setBusy(false)
    if (ok) onClose()
  }

  const scoreInput = (value: string, set: (v: string) => void, label: string, invalid: boolean) => (
    <input
      className="input num !h-20 !w-24 !px-0 text-center !text-5xl"
      inputMode="numeric"
      maxLength={2}
      value={value}
      onChange={(e) => {
        set(e.target.value)
        setConfirming(false)
      }}
      aria-label={label}
      aria-invalid={invalid}
      placeholder="–"
    />
  )

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={correcting ? 'Correct result' : 'Enter result'}
      title={`${ROUND_LABEL[match.round]} — Match ${pad2(match.match_number)}`}
      width="max-w-xl"
      footer={
        confirming ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={busy}>
              Back
            </button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Confirm correction'}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy || Boolean(error && tried) || blockedByNext}>
              {correcting ? 'Review correction' : busy ? 'Saving…' : 'Submit result'}
            </button>
          </>
        )
      }
    >
      {confirming && sa !== null && sb !== null ? (
        <div className="space-y-4 text-sm text-soft">
          <p>You're about to change this result:</p>
          <div className="panel p-4">
            <div className="label text-[0.7rem] text-mute">Before</div>
            <div className="display text-2xl text-soft">
              {p1.name} <span className="num text-white">{match.player1_score}–{match.player2_score}</span> {p2.name}
            </div>
            <div className="label mt-3 text-[0.7rem] text-pitch">After</div>
            <div className="display text-2xl text-white">
              {p1.name} <span className="num text-pitch">{sa}–{sb}</span> {p2.name}
            </div>
          </div>
          {winnerChanges && winner ? (
            <p className="border-l-2 border-warn bg-warn/10 px-3 py-2 text-warn">
              The winner changes to <strong>{winner.name}</strong>. Wins, losses, points and the bracket will all be recalculated
              {target ? <> and {winner.name} will replace the previous winner in {ROUND_LABEL[target.round]} match {target.match_number}.</> : '.'}
            </p>
          ) : (
            <p>The winner stays the same — standings keep their wins/losses, only the score changes.</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <PlayerAvatar player={p1} size={56} />
              <div className="display text-xl text-white sm:text-2xl">{p1.name}</div>
              {scoreInput(a, setA, `${p1.name} score`, Boolean(error))}
            </div>
            <div className="display pt-10 text-2xl text-mute">VS</div>
            <div className="flex flex-col items-center gap-3 text-center">
              <PlayerAvatar player={p2} size={56} />
              <div className="display text-xl text-white sm:text-2xl">{p2.name}</div>
              {scoreInput(b, setB, `${p2.name} score`, Boolean(error))}
            </div>
          </div>

          <div className="mt-6 min-h-[3.25rem]" aria-live="polite">
            {error ? (
              <div role="alert" className="flex items-start gap-2 border-l-2 border-danger bg-danger/10 px-3 py-2.5 text-sm text-danger">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            ) : blockedByNext && winner && nextMatch ? (
              <div role="alert" className="flex items-start gap-2 border-l-2 border-danger bg-danger/10 px-3 py-2.5 text-sm text-danger">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                This would change the winner, but {ROUND_LABEL[nextMatch.round]} match {nextMatch.match_number} has already been played.
                Correct that result first.
              </div>
            ) : winner ? (
              <div className="flex items-start gap-2 border-l-2 border-pitch bg-pitch/[0.08] px-3 py-2.5 text-sm text-soft">
                <Trophy size={16} className="mt-0.5 shrink-0 text-pitch" />
                <span>
                  Winner: <strong className="text-white">{winner.name}</strong> (+1 point).
                  {target && (
                    <>
                      {' '}
                      Advances to <strong className="text-white">{ROUND_LABEL[target.round]}</strong> <ArrowRight size={12} className="inline" /> match {target.match_number}.
                    </>
                  )}
                  {!target && ' This decides the tournament.'}
                </span>
              </div>
            ) : (
              <p className="text-sm text-mute">Enter both scores. The winner is worked out automatically — no draws.</p>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

type Filter = 'PENDING' | 'COMPLETED' | 'ALL'

export default function AdminResults() {
  const { matches, players, status } = useTournament()
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [active, setActive] = useState<Match | null>(null)

  const list = useMemo(() => {
    return matches
      .filter((m) => m.status !== 'CANCELLED')
      .filter((m) => (filter === 'ALL' ? true : filter === 'COMPLETED' ? m.status === 'COMPLETED' : m.status !== 'COMPLETED'))
      .sort(compareMatches)
  }, [matches, filter])

  const activeP1 = active?.player1_id ? byId.get(active.player1_id) : undefined
  const activeP2 = active?.player2_id ? byId.get(active.player2_id) : undefined

  return (
    <>
      <AdminPageHeader
        title="Results"
        subtitle="Enter the score. The winner, wins, losses, points, standings and bracket all update automatically."
      />

      <div className="mb-5 flex gap-2">
        {(['PENDING', 'COMPLETED', 'ALL'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`label px-4 py-2 text-[0.82rem] ring-1 ring-inset transition-colors ${
              filter === f ? 'bg-pitch text-ink-950 ring-pitch' : 'bg-white/[0.04] text-soft ring-white/12 hover:text-white'
            }`}
          >
            {f === 'PENDING' ? 'Awaiting result' : f}
          </button>
        ))}
      </div>

      {status === 'loading' ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          compact
          icon={<ClipboardCheck size={26} />}
          title={filter === 'COMPLETED' ? 'No results yet' : matches.length === 0 ? 'Fixtures pending' : 'All results are in'}
          message={
            filter === 'COMPLETED'
              ? 'Match results will appear here once the tournament begins.'
              : matches.length === 0
                ? 'Create fixtures first, then come back to enter results.'
                : 'There are no matches waiting for a result.'
          }
        />
      ) : (
        <div className="panel divide-y divide-white/[0.06]">
          {list.map((m) => {
            const p1 = m.player1_id ? byId.get(m.player1_id) : undefined
            const p2 = m.player2_id ? byId.get(m.player2_id) : undefined
            const ready = Boolean(p1 && p2)
            const done = m.status === 'COMPLETED'
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-5">
                <div className="w-36 shrink-0">
                  <div className="eyebrow !text-[0.7rem]">{ROUND_LABEL[m.round]}</div>
                  <div className="label text-[0.7rem] text-mute">
                    Match {pad2(m.match_number)} · {fmtKickoff(m.scheduled_at)}
                  </div>
                </div>
                <div className="display flex min-w-0 flex-1 basis-60 flex-wrap items-center gap-x-3 text-xl text-white sm:text-2xl">
                  <span className={done && m.winner_id === m.player1_id ? 'text-pitch' : ''}>{p1?.name ?? <span className="text-mute/70">TBD</span>}</span>
                  {done ? (
                    <span className="num text-3xl text-white">
                      {m.player1_score} – {m.player2_score}
                    </span>
                  ) : (
                    <span className="text-mute">vs</span>
                  )}
                  <span className={done && m.winner_id === m.player2_id ? 'text-pitch' : ''}>{p2?.name ?? <span className="text-mute/70">TBD</span>}</span>
                </div>
                <StatusPill status={m.status} />
                <button
                  className={`btn btn-sm ${done ? 'btn-ghost' : 'btn-primary'}`}
                  disabled={!ready}
                  onClick={() => setActive(m)}
                  title={ready ? undefined : 'Waiting for both players to be decided'}
                >
                  {done ? (
                    <>
                      <Pencil size={14} /> Edit result
                    </>
                  ) : ready ? (
                    'Enter result'
                  ) : (
                    'Awaiting players'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {active && activeP1 && activeP2 && (
        <ResultModal key={active.id} match={active} p1={activeP1} p2={activeP2} onClose={() => setActive(null)} />
      )}
    </>
  )
}
