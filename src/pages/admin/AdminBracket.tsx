import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Shuffle, Swords, Trash2 } from 'lucide-react'
import { backend } from '../../lib/api'
import { MAX_BRACKET_PLAYERS, MIN_BRACKET_PLAYERS, ROUND_LABEL, buildBracketSkeleton, describeBracket, isBracketMatch, stageRound } from '../../lib/bracket'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { AdvancePlayers } from '../../components/admin/AdvancePlayers'
import { FinishBracket } from '../../components/admin/FinishBracket'
import { AdvancementModeSwitch } from '../../components/admin/AdvancementModeSwitch'
import { UpgradeNotice } from '../../components/admin/UpgradeNotice'
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
  const { players, schemaReady } = useTournament()
  const run = useAdminAction()
  const [selected, setSelected] = useState<string[]>([])
  const [randomDraw, setRandomDraw] = useState(true)
  const [draw, setDraw] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

  const n = selected.length
  // Until the database is upgraded its generator only knows full brackets (2, 4, 8, 16, 32 or 64 players).
  const powerOfTwo = n > 0 && (n & (n - 1)) === 0
  const valid = n >= MIN_BRACKET_PLAYERS && n <= MAX_BRACKET_PLAYERS && (schemaReady || powerOfTwo)

  const preview = useMemo(() => {
    if (!draw) return null
    const skeleton = buildBracketSkeleton(draw)
    return { skeleton, ...describeBracket(skeleton) }
  }, [draw])

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
    return <div className="panel p-6 text-sm text-mute">Add at least two players before generating a bracket.</div>
  }

  const name = (id: string | null) => (id ? (byId.get(id)?.name ?? '?') : 'TBD')

  return (
    <div className="panel p-5 sm:p-6">
      <div className="eyebrow mb-1 !text-[0.72rem]">Step 1</div>
      <h2 className="display text-3xl text-white">Choose who's playing</h2>
      <p className="mt-1 text-sm text-mute">
        Any number from {MIN_BRACKET_PLAYERS} to {MAX_BRACKET_PLAYERS}. Everyone plays in the first round; a bye only happens when a round has an
        odd number of players.
      </p>

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
        <button className="btn btn-ghost btn-sm" onClick={() => { setDraw(null); setSelected(players.slice(0, MAX_BRACKET_PLAYERS).map((p) => p.id)) }}>
          Select all
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setDraw(null); setSelected([]) }} disabled={n === 0}>
          Clear
        </button>
        <span className={`label text-[0.85rem] ${valid ? 'text-pitch' : 'text-mute'}`}>
          {n} selected {valid ? `· ${n - 1} matches · starts at ${ROUND_LABEL[stageRound(n)]}` : ''}
        </span>
      </div>
      {!schemaReady && n >= MIN_BRACKET_PLAYERS && n <= MAX_BRACKET_PLAYERS && !powerOfTwo && (
        <p className="mt-2 text-sm text-warn">
          Until the database upgrade is run, a bracket needs exactly 2, 4, 8, 16, 32 or 64 players. Any number (like {n}) works after the upgrade.
        </p>
      )}
      {n > MAX_BRACKET_PLAYERS && <p className="mt-2 text-sm text-warn">A bracket holds at most {MAX_BRACKET_PLAYERS} players. Deselect {n - MAX_BRACKET_PLAYERS}.</p>}
      {n === 1 && <p className="mt-2 text-sm text-warn">Select at least {MIN_BRACKET_PLAYERS} players.</p>}

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
        </div>

        {preview && draw && (
          <div className="mt-5 space-y-6">
            <div>
              <div className="label mb-2 text-[0.75rem] text-mute">How the tournament will run</div>
              <ol className="divide-y divide-white/[0.06] border border-white/[0.08]">
                {preview.plan.map((r, i) => (
                  <li key={r.round} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                    <span className="display w-40 text-xl text-white">{ROUND_LABEL[r.round]}</span>
                    <span className="num text-lg text-pitch">{r.matches} {r.matches === 1 ? 'match' : 'matches'}</span>
                    {r.byes > 0 && (
                      <span className="text-sm text-warn">
                        {r.byes} {r.byes === 1 ? 'player skips' : 'players skip'} this round (bye): the winner of the last{' '}
                        {ROUND_LABEL[preview.plan[i - 1]?.round ?? preview.firstRound]} match
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-mute">
                Every match knocks one player out, so a bracket of {draw.length} always has {draw.length - 1} matches in total.
              </p>
            </div>

            {preview.earlyPlayers.length > 0 && (
              <div className="border-l-2 border-warn bg-warn/10 px-3 py-2 text-sm text-warn">
                With an odd number of players, <strong>{name(preview.earlyPlayers[0])}</strong> has no opponent in the {ROUND_LABEL[preview.firstRound]}{' '}
                and starts in the next round. Add or remove one player to avoid this.
              </div>
            )}

            <div>
              <div className="label mb-2 text-[0.75rem] text-mute">{ROUND_LABEL[preview.firstRound]} pairings</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {preview.skeleton
                  .filter((m) => m.round === preview.firstRound)
                  .map((m) => (
                    <div key={m.key} className="flex items-center gap-3 bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/10">
                      <span className="num w-8 text-lg text-mute">M{m.match_number}</span>
                      <span className="display min-w-0 flex-1 truncate text-xl text-white">
                        {name(m.player1_id)} <span className="text-mute">vs</span> {name(m.player2_id)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <button className="btn btn-primary" onClick={create} disabled={busy}>
                <Swords size={16} /> {busy ? 'Creating…' : 'Create bracket'}
              </button>
              <p className="mt-2 text-xs text-mute">Later rounds are created empty and fill in automatically as results are entered. You can set dates afterwards under Fixtures.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminBracket() {
  const { matches, tournament, schemaReady } = useTournament()
  const run = useAdminAction()
  const [resetting, setResetting] = useState(false)
  const hasBracket = matches.some(isBracketMatch) // extra matches alone don't make a bracket

  return (
    <>
      <AdminPageHeader
        title="Bracket"
        subtitle="This is exactly what the public sees. You choose whether winners advance by themselves or you decide who goes to each next round."
      />

      <UpgradeNotice feature="Choosing who goes to the next round, brackets for any number of players, and finishing a hand-made bracket" />
      {schemaReady && (
        <div className="panel mb-6 p-4 sm:p-5">
          <h2 className="display mb-3 text-2xl text-white">Who goes to the next round?</h2>
          <AdvancementModeSwitch />
        </div>
      )}

      {!hasBracket ? (
        <Generator />
      ) : (
        <>
          <FinishBracket />
          <KnockoutBracket />
          <AdvancePlayers />

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
