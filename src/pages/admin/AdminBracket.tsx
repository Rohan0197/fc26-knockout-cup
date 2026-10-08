import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Shuffle, Swords, Trash2 } from 'lucide-react'
import { backend } from '../../lib/api'
import { ROUND_LABEL, VALID_BRACKET_SIZES, firstRoundFor } from '../../lib/bracket'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { KnockoutBracket } from '../../components/KnockoutBracket'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PlayerAvatar } from '../../components/ui/PlayerAvatar'

const api = backend!.api

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function Generator() {
  const { players } = useTournament()
  const run = useAdminAction()
  const [selected, setSelected] = useState<string[]>([])
  const [randomDraw, setRandomDraw] = useState(true)
  const [draw, setDraw] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

  const n = selected.length
  const valid = (VALID_BRACKET_SIZES as readonly number[]).includes(n)
  const first = firstRoundFor(n)

  const toggle = (id: string) => {
    setDraw(null)
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const create = async () => {
    if (!draw) return
    setBusy(true)
    await run(() => api.generateBracket(draw), 'Bracket created.')
    setBusy(false)
  }

  if (players.length < 2) {
    return (
      <div className="panel p-6 text-sm text-mute">Add at least two players before generating a bracket.</div>
    )
  }

  return (
    <div className="panel p-5 sm:p-6">
      <div className="eyebrow mb-1 !text-[0.72rem]">Step 1</div>
      <h2 className="display text-3xl text-white">Choose who's playing</h2>
      <p className="mt-1 text-sm text-mute">A knockout bracket needs exactly 2, 4, 8, 16, 32 or 64 players.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => {
          const on = selected.includes(p.id)
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              aria-pressed={on}
              className={`flex items-center gap-3 px-3 py-2.5 text-left ring-1 ring-inset transition-colors ${
                on ? 'bg-pitch/[0.1] ring-pitch/60' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'
              }`}
            >
              <PlayerAvatar player={p} size={32} />
              <span className="display min-w-0 flex-1 truncate text-xl text-white">{p.name}</span>
              <span className={`grid h-5 w-5 place-items-center ${on ? 'bg-pitch text-ink-950' : 'border border-white/20'}`}>
                {on && <Check size={13} strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button className="btn btn-ghost btn-sm" onClick={() => { setDraw(null); setSelected(players.map((p) => p.id)) }}>
          Select all
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setDraw(null); setSelected([]) }} disabled={n === 0}>
          Clear
        </button>
        <span className={`label text-[0.85rem] ${valid ? 'text-pitch' : 'text-mute'}`}>
          {n} selected {valid && first ? `· starts at ${ROUND_LABEL[first]}` : ''}
        </span>
      </div>

      <div className="mt-7 border-t border-white/[0.07] pt-6">
        <div className="eyebrow mb-1 !text-[0.72rem]">Step 2</div>
        <h2 className="display text-3xl text-white">Draw the bracket</h2>
        <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-soft">
          <input type="checkbox" checked={randomDraw} onChange={(e) => { setRandomDraw(e.target.checked); setDraw(null) }} className="h-4 w-4 accent-[#2bff88]" />
          Random draw <span className="text-mute">(otherwise players are paired in the order shown above: 1v2, 3v4…)</span>
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="btn btn-ghost"
            disabled={!valid}
            onClick={() => {
              const order = selected.slice().sort((a, b) => players.findIndex((p) => p.id === a) - players.findIndex((p) => p.id === b))
              setDraw(randomDraw ? shuffle(selected) : order)
            }}
          >
            <Shuffle size={16} /> {draw ? 'Redraw' : 'Draw'}
          </button>
          {!valid && n > 0 && <span className="text-sm text-warn">{n < 2 ? 'Select at least 2 players.' : `Select ${VALID_BRACKET_SIZES.find((x) => x > n) ?? 64} players${VALID_BRACKET_SIZES.filter((x) => x < n).length ? ` (or ${VALID_BRACKET_SIZES.filter((x) => x < n).pop()})` : ''}.`}</span>}
        </div>

        {draw && (
          <div className="mt-5">
            <div className="label mb-2 text-[0.75rem] text-mute">{first && ROUND_LABEL[first]} pairings</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: draw.length / 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/10">
                  <span className="num w-7 text-lg text-mute">M{i + 1}</span>
                  <span className="display min-w-0 flex-1 truncate text-xl text-white">
                    {byId.get(draw[2 * i])?.name} <span className="text-mute">vs</span> {byId.get(draw[2 * i + 1])?.name}
                  </span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary mt-5" onClick={create} disabled={busy}>
              <Swords size={16} /> {busy ? 'Creating…' : 'Create bracket'}
            </button>
            <p className="mt-2 text-xs text-mute">Later rounds are created empty and fill in automatically as results are entered. You can set dates afterwards under Fixtures.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminBracket() {
  const { matches, tournament } = useTournament()
  const run = useAdminAction()
  const [resetting, setResetting] = useState(false)

  return (
    <>
      <AdminPageHeader
        title="Bracket"
        subtitle="Winners advance automatically when you enter a result. This is exactly what the public sees."
      />

      {matches.length === 0 ? (
        <Generator />
      ) : (
        <>
          <KnockoutBracket />

          <div className="panel mt-8 border-danger/30 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 shrink-0 text-danger" size={20} />
              <div className="flex-1">
                <h2 className="display text-2xl text-white">Danger zone</h2>
                <p className="mt-1 text-sm text-mute">
                  Resetting removes <strong className="text-soft">every fixture and result</strong> ({matches.length} matches,{' '}
                  {tournament.completed} played). Players are kept. This can't be undone.
                </p>
                <button className="btn btn-danger btn-sm mt-4" onClick={() => setResetting(true)}>
                  <Trash2 size={14} /> Reset tournament
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={resetting}
        danger
        title="Reset the tournament?"
        confirmLabel="Reset everything"
        requireText="RESET"
        onClose={() => setResetting(false)}
        onConfirm={async () => {
          const ok = await run(() => api.resetTournament(), 'Tournament reset. Players were kept.')
          if (ok) setResetting(false)
        }}
      >
        <p>
          All {matches.length} fixtures and {tournament.completed} results will be permanently deleted, and every player's record goes back
          to 0–0. The public site will show "Fixtures pending" until you generate a new bracket.
        </p>
      </ConfirmDialog>
    </>
  )
}
