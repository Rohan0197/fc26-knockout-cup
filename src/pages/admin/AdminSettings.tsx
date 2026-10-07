import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { backend } from '../../lib/api'
import { resetDemoData } from '../../lib/demoStore'
import { useAuth } from '../../context/AuthContext'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { Field } from '../../components/admin/Field'

const api = backend!.api

export default function AdminSettings() {
  const { settings, mode, refresh } = useTournament()
  const { session } = useAuth()
  const run = useAdminAction()
  const [name, setName] = useState(settings.name)
  const [subtitle, setSubtitle] = useState(settings.subtitle)
  const [organizer, setOrganizer] = useState(settings.organizer)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(settings.name)
    setSubtitle(settings.subtitle)
    setOrganizer(settings.organizer)
  }, [settings])

  const dirty = name !== settings.name || subtitle !== settings.subtitle || organizer !== settings.organizer
  const nameError = touched && !name.trim() ? 'Tournament name is required.' : undefined

  const save = async () => {
    setTouched(true)
    if (!name.trim()) return
    setBusy(true)
    await run(() => api.updateSettings({ name: name.trim(), subtitle: subtitle.trim(), organizer: organizer.trim() }), 'Settings saved.')
    setBusy(false)
  }

  return (
    <>
      <AdminPageHeader title="Settings" subtitle="Branding shown on the public site. Players, fixtures and results live on their own pages." />

      <div className="panel max-w-2xl space-y-4 p-5 sm:p-6">
        <Field label="Tournament name *" error={nameError}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(nameError)} maxLength={60} />
        </Field>
        <Field label="Tagline" hint='Shown under the title, e.g. "The Road to the Final".'>
          <input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Organiser" hint='Footer reads "Powered by …".'>
          <input className="input" value={organizer} onChange={(e) => setOrganizer(e.target.value)} maxLength={80} />
        </Field>
        <button className="btn btn-primary" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div className="panel mt-6 max-w-2xl p-5 sm:p-6">
        <h2 className="display text-2xl text-white">Account</h2>
        <p className="mt-2 text-sm text-mute">
          Signed in as <span className="text-white">{session?.email}</span>
        </p>
        <p className="mt-1 text-sm text-mute">
          Backend: <span className="text-white">{mode === 'supabase' ? 'Supabase' : 'Local demo (development only)'}</span>
        </p>
      </div>

      {mode === 'demo' && (
        <div className="panel mt-6 max-w-2xl border-warn/40 p-5 sm:p-6">
          <h2 className="display flex items-center gap-2 text-2xl text-warn">
            <FlaskConical size={20} /> Demo data
          </h2>
          <p className="mt-2 text-sm text-mute">Restore the original sample players and fixtures. Only affects this browser.</p>
          <button
            className="btn btn-ghost btn-sm mt-4"
            onClick={() => {
              resetDemoData()
              void refresh()
              window.location.reload()
            }}
          >
            Reset demo data
          </button>
        </div>
      )}
    </>
  )
}
