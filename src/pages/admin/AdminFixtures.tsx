import { useMemo, useState } from 'react'
import { CalendarDays, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Match, MatchInput, MatchStatus, Round } from '../../types'
import { backend } from '../../lib/api'
import { ROUND_LABEL, ROUND_ORDER, groupByRound } from '../../lib/bracket'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'
import { fmtKickoff, fromDateTimeInputs, pad2, toDateTimeInputs } from '../../utils/format'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { UpgradeNotice } from '../../components/admin/UpgradeNotice'
import { Field } from '../../components/admin/Field'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatusPill } from '../../components/ui/StatusPill'

const api = backend!.api
const EDITABLE_STATUSES: MatchStatus[] = ['UPCOMING', 'LIVE', 'CANCELLED']
const ALL_ROUNDS: Round[] = [...ROUND_ORDER, 'EXTRA']

function FixtureForm({ editing, preset, onClose }: { editing: Match | null; preset?: Round; onClose: () => void }) {
  const { players, matches, schemaReady } = useTournament()
  const run = useAdminAction()
  const locked = editing?.status === 'COMPLETED' // players/round/number are frozen once played
  const initial = toDateTimeInputs(editing?.scheduled_at ?? null)

  const [round, setRound] = useState<Round>(editing?.round ?? preset ?? ROUND_ORDER.find((r) => matches.some((m) => m.round === r)) ?? 'QUARTER_FINAL')
  const nextNumber = useMemo(() => Math.max(0, ...matches.filter((m) => m.round === round).map((m) => m.match_number)) + 1, [matches, round])
  const [number, setNumber] = useState<string>(String(editing?.match_number ?? nextNumber))
  const [p1, setP1] = useState(editing?.player1_id ?? '')
  const [p2, setP2] = useState(editing?.player2_id ?? '')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [status, setStatus] = useState<MatchStatus>(editing?.status ?? 'UPCOMING')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  // Extra matches sit outside the bracket: unlimited, numbered automatically, any pair of players (repeats allowed).
  const isExtra = round === 'EXTRA'
  const n = isExtra ? (editing?.match_number ?? nextNumber) : Number(number)
  const errors: Record<string, string> = {}
  if (!isExtra) {
    if (!Number.isInteger(n) || n < 1 || n > 32) errors.number = 'Match number must be a whole number from 1 to 32.'
    else if (matches.some((m) => m.id !== editing?.id && m.round === round && m.match_number === n))
      errors.number = `${ROUND_LABEL[round]} match ${n} already exists.`
  } else if (!editing || !locked) {
    if (!p1) errors.p1 = 'Choose a player.'
    if (!p2) errors.p2 = 'Choose a player.'
  }
  if (p1 && p1 === p2) errors.p2 = 'A player cannot play themselves.'
  if (!isExtra)
    for (const [key, pid] of [['p1', p1], ['p2', p2]] as const) {
      if (!pid) continue
      const clash = matches.find(
        (m) => m.id !== editing?.id && m.round === round && m.status !== 'CANCELLED' && (m.player1_id === pid || m.player2_id === pid),
      )
      if (clash && !errors[key]) errors[key] = `Already playing in ${ROUND_LABEL[round]} match ${clash.match_number}.`
    }
  if (time && !date) errors.date = 'Pick a date for this kick-off time.'

  const submit = async () => {
    setTouched(true)
    if (Object.keys(errors).length > 0) return
    const input: MatchInput = {
      round,
      match_number: n,
      player1_id: p1 || null,
      player2_id: p2 || null,
      scheduled_at: fromDateTimeInputs(date, time),
      status: locked ? 'COMPLETED' : status,
    }
    setBusy(true)
    const ok = await run(
      () =>
        editing
          ? api.updateMatch(
              editing.id,
              locked ? { scheduled_at: input.scheduled_at } : input, // a played match can only be rescheduled here
            )
          : isExtra
            ? api.createExtraMatch(p1, p2, input.scheduled_at)
            : api.createMatch(input),
      editing ? 'Fixture updated.' : isExtra ? 'Extra match added.' : 'Fixture created.',
    )
    setBusy(false)
    if (ok) onClose()
  }

  const err = (k: string) => (touched ? errors[k] : undefined)
  const playerOptions = (
    <>
      <option value="">{isExtra ? 'Choose a player…' : 'TBD (decided by earlier round)'}</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={editing ? 'Edit fixture' : isExtra ? 'Extra match' : 'New fixture'}
      title={editing ? `${ROUND_LABEL[editing.round]} · Match ${pad2(editing.match_number)}` : isExtra ? 'Add extra match' : 'Add fixture'}
      width="max-w-xl"
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save fixture'}
          </button>
        </>
      }
    >
      {locked && (
        <div className="mb-4 flex items-start gap-2 border-l-2 border-warn bg-warn/10 px-3 py-2 text-xs text-warn">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>This match has been played. Only the date and time can be changed here — use Results to correct the score.</span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Round">
          <select
            className="input"
            value={round}
            disabled={locked}
            onChange={(e) => {
              const r = e.target.value as Round
              setRound(r)
              // suggest the next free match number of the round you picked (never a number that already exists)
              if (!editing) setNumber(String(Math.max(0, ...matches.filter((m) => m.round === r).map((m) => m.match_number)) + 1))
            }}
          >
            {ALL_ROUNDS.filter((r) => r !== 'EXTRA' || schemaReady || editing?.round === 'EXTRA').map((r) => (
              <option key={r} value={r}>
                {r === 'EXTRA' ? 'Extra match (outside the bracket)' : ROUND_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        {isExtra ? (
          <Field label="Match number" hint="Numbered automatically.">
            <input className="input" value={editing ? pad2(editing.match_number) : pad2(nextNumber)} disabled readOnly />
          </Field>
        ) : (
          <Field label="Match number" error={err('number')}>
            <input className="input" inputMode="numeric" value={number} disabled={locked} onChange={(e) => setNumber(e.target.value)} aria-invalid={Boolean(err('number'))} />
          </Field>
        )}
        <Field label="Player 1" error={err('p1')}>
          <select className="input" value={p1} disabled={locked} onChange={(e) => setP1(e.target.value)} aria-invalid={Boolean(err('p1'))}>
            {playerOptions}
          </select>
        </Field>
        <Field label="Player 2" error={err('p2')}>
          <select className="input" value={p2} disabled={locked} onChange={(e) => setP2(e.target.value)} aria-invalid={Boolean(err('p2'))}>
            {playerOptions}
          </select>
        </Field>
        <Field label="Date" error={err('date')}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time">
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Status" className="sm:col-span-2" hint="A match becomes COMPLETED only by entering its result.">
          <select className="input" value={locked ? 'COMPLETED' : status} disabled={locked} onChange={(e) => setStatus(e.target.value as MatchStatus)}>
            {locked && <option value="COMPLETED">COMPLETED</option>}
            {EDITABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="mt-4 text-xs text-mute">
        {isExtra
          ? 'Extra matches are outside the bracket: add as many as you like, between any two players (even the same pair again). Their results count in the standings.'
          : 'Leave a player as TBD for later rounds. In automatic mode winners are placed into them for you; in manual mode you place players from the Bracket page.'}
      </p>
    </Modal>
  )
}

export default function AdminFixtures() {
  const { matches, players, status, schemaReady } = useTournament()
  const run = useAdminAction()
  const [editing, setEditing] = useState<Match | 'new' | 'extra' | null>(null)
  const [deleting, setDeleting] = useState<Match | null>(null)
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const rounds = useMemo(() => groupByRound(matches), [matches])

  return (
    <>
      <AdminPageHeader
        title="Fixtures"
        subtitle="Stored in the database and shown live on the public site. Use the Bracket page to generate a whole bracket at once."
        actions={
          <div className="flex flex-wrap gap-2">
            {schemaReady && (
              <button className="btn btn-ghost" onClick={() => setEditing('extra')} disabled={players.length < 2}>
                <Plus size={16} /> Add extra match
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={players.length < 2}>
              <Plus size={16} /> Add fixture
            </button>
          </div>
        }
      />

      <UpgradeNotice feature="Extra matches" />

      {status === 'loading' ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={26} />}
          title="Fixtures pending"
          message={
            players.length < 2
              ? 'Add at least two players first, then create fixtures or generate the whole bracket.'
              : 'No fixtures yet. Generate the full bracket from the Bracket page, or add matches one by one.'
          }
        />
      ) : (
        <div className="space-y-8">
          {rounds.map((g) => (
            <section key={g.round}>
              <h2 className="display mb-3 text-2xl text-white">{ROUND_LABEL[g.round]}</h2>
              <div className="panel divide-y divide-white/[0.06]">
                {g.matches.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                    <span className="num w-10 text-xl text-mute">M{pad2(m.match_number)}</span>
                    <div className="display min-w-0 flex-1 basis-56 truncate text-xl text-white sm:text-2xl">
                      {byId.get(m.player1_id ?? '')?.name ?? <span className="text-mute/70">TBD</span>}
                      {m.status === 'COMPLETED' ? (
                        <span className="num mx-2 text-pitch">
                          {m.player1_score}–{m.player2_score}
                        </span>
                      ) : (
                        <span className="mx-2 text-mute">vs</span>
                      )}
                      {byId.get(m.player2_id ?? '')?.name ?? <span className="text-mute/70">TBD</span>}
                    </div>
                    <span className="label text-[0.75rem] text-mute">{fmtKickoff(m.scheduled_at)}</span>
                    <StatusPill status={m.status} />
                    <div className="ml-auto flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(m)} aria-label="Edit fixture">
                        <Pencil size={14} /> <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleting(m)}
                        disabled={m.status === 'COMPLETED'}
                        title={m.status === 'COMPLETED' ? 'Played matches can’t be deleted' : 'Delete fixture'}
                        aria-label="Delete fixture"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <FixtureForm
          key={typeof editing === 'string' ? editing : editing.id}
          editing={typeof editing === 'string' ? null : editing}
          preset={editing === 'extra' ? 'EXTRA' : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this fixture?"
        confirmLabel="Delete fixture"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          const ok = await run(() => api.deleteMatch(deleting.id), 'Fixture deleted.')
          if (ok) setDeleting(null)
        }}
      >
        <p>
          {deleting && `${ROUND_LABEL[deleting.round]} · Match ${deleting.match_number}`} will be removed from the schedule and the bracket.
        </p>
      </ConfirmDialog>
    </>
  )
}
