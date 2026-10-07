import { useState } from 'react'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import type { Player, PlayerInput } from '../../types'
import { backend } from '../../lib/api'
import { normalizeName } from '../../lib/calculations'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'
import { suggestShortName } from '../../utils/format'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { Field } from '../../components/admin/Field'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { PlayerAvatar } from '../../components/ui/PlayerAvatar'

const api = backend!.api

interface FormState {
  name: string
  short_name: string
  club: string
  avatar_url: string
}
const EMPTY: FormState = { name: '', short_name: '', club: '', avatar_url: '' }

const isHttpUrl = (s: string) => {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function PlayerForm({ editing, onClose }: { editing: Player | null; onClose: () => void }) {
  const { players } = useTournament()
  const run = useAdminAction()
  const [f, setF] = useState<FormState>(
    editing
      ? { name: editing.name, short_name: editing.short_name ?? '', club: editing.club ?? '', avatar_url: editing.avatar_url ?? '' }
      : EMPTY,
  )
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const errors: Partial<Record<keyof FormState, string>> = {}
  if (!f.name.trim()) errors.name = 'Name is required.'
  else if (f.name.trim().length > 60) errors.name = 'Name must be 60 characters or fewer.'
  else if (players.some((p) => p.id !== editing?.id && normalizeName(p.name) === normalizeName(f.name)))
    errors.name = 'A player with this name already exists.'
  if (f.short_name.trim().length > 12) errors.short_name = 'Short name must be 12 characters or fewer.'
  if (f.avatar_url.trim() && !isHttpUrl(f.avatar_url.trim())) errors.avatar_url = 'Enter a full image URL starting with https://'

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }))
  const show = (k: keyof FormState) => (touched ? errors[k] : undefined)

  const submit = async () => {
    setTouched(true)
    if (Object.keys(errors).length > 0) return
    const input: PlayerInput = {
      name: f.name.trim().replace(/\s+/g, ' '),
      short_name: f.short_name.trim() || null,
      club: f.club.trim() || null,
      avatar_url: f.avatar_url.trim() || null,
    }
    setBusy(true)
    const ok = await run(
      () => (editing ? api.updatePlayer(editing.id, input) : api.createPlayer(input)),
      editing ? 'Player updated.' : 'Player added.',
    )
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={editing ? 'Edit player' : 'New player'}
      title={editing ? editing.name : 'Add player'}
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add player'}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        noValidate
      >
        <Field label="Name *" error={show('name')}>
          <input
            className="input"
            value={f.name}
            onChange={set('name')}
            onBlur={() => !f.short_name && setF((s) => ({ ...s, short_name: suggestShortName(s.name) }))}
            aria-invalid={Boolean(show('name'))}
            autoFocus
            maxLength={80}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Short name" error={show('short_name')} hint="Shown where space is tight (max 12).">
            <input className="input" value={f.short_name} onChange={set('short_name')} aria-invalid={Boolean(show('short_name'))} />
          </Field>
          <Field label="Team / club (optional)">
            <input className="input" value={f.club} onChange={set('club')} />
          </Field>
        </div>
        <Field label="Avatar image URL (optional)" error={show('avatar_url')} hint="Leave blank for the default silhouette.">
          <input className="input" value={f.avatar_url} onChange={set('avatar_url')} placeholder="https://…" aria-invalid={Boolean(show('avatar_url'))} />
        </Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}

export default function AdminPlayers() {
  const { standings, matches, status } = useTournament()
  const run = useAdminAction()
  const [editing, setEditing] = useState<Player | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Player | null>(null)

  const deleteInfo = (p: Player) => {
    const involved = matches.filter((m) => m.player1_id === p.id || m.player2_id === p.id)
    return {
      completed: involved.filter((m) => m.status === 'COMPLETED').length,
      pending: involved.filter((m) => m.status !== 'COMPLETED').length,
    }
  }
  const info = deleting ? deleteInfo(deleting) : null

  return (
    <>
      <AdminPageHeader
        title="Players"
        subtitle="Wins, losses and points are calculated automatically from match results and can't be edited here."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} /> Add player
          </button>
        }
      />

      {status === 'loading' ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      ) : standings.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="No players yet"
          message="Add the people taking part. You can build the bracket once you have 2, 4, 8 or 16 players."
          action={
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> Add first player
            </button>
          }
        />
      ) : (
        <div className="panel divide-y divide-white/[0.06]">
          {standings.map((s) => (
            <div key={s.player.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <PlayerAvatar player={s.player} size={44} />
              <div className="min-w-0 flex-1 basis-40">
                <div className="display truncate text-2xl text-white">{s.player.name}</div>
                <div className="label truncate text-[0.7rem] text-mute">
                  {[s.player.short_name, s.player.club].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <div className="num text-lg text-soft" title="Calculated from results">
                {s.wins}W – {s.losses}L · <span className="text-pitch">{s.points} pts</span>
              </div>
              <div className="ml-auto flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s.player)} aria-label={`Edit ${s.player.name}`}>
                  <Pencil size={14} /> <span className="hidden sm:inline">Edit</span>
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeleting(s.player)} aria-label={`Delete ${s.player.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <PlayerForm key={editing === 'new' ? 'new' : editing.id} editing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={Boolean(deleting) && Boolean(info && info.completed === 0)}
        title={deleting ? `Delete ${deleting.name}?` : ''}
        confirmLabel="Delete player"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          const ok = await run(() => api.deletePlayer(deleting.id), 'Player deleted.')
          if (ok) setDeleting(null)
        }}
      >
        <p>This permanently removes the player.</p>
        {info && info.pending > 0 && (
          <p className="border-l-2 border-warn bg-warn/10 px-3 py-2 text-warn">
            They are in {info.pending} scheduled fixture{info.pending > 1 ? 's' : ''}. Those slots will become <strong>TBD</strong>.
          </p>
        )}
      </ConfirmDialog>

      {/* Players with played matches can't be deleted - that would rewrite tournament history. */}
      <Modal
        open={Boolean(deleting) && Boolean(info && info.completed > 0)}
        onClose={() => setDeleting(null)}
        title="Can't delete this player"
        eyebrow="Match history exists"
        width="max-w-md"
        footer={
          <button className="btn btn-primary btn-sm" onClick={() => setDeleting(null)}>
            Understood
          </button>
        }
      >
        <p className="text-sm leading-relaxed text-soft">
          <strong className="text-white">{deleting?.name}</strong> has {info?.completed} completed match{(info?.completed ?? 0) > 1 ? 'es' : ''}. Deleting them
          would corrupt results, standings and the bracket, so it's blocked. To start over, reset the tournament from the Bracket page first.
        </p>
      </Modal>
    </>
  )
}
