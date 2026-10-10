import { useState } from 'react'
import { Hand, Zap } from 'lucide-react'
import { backend } from '../../lib/api'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'
import type { AdvancementMode } from '../../types'

const api = backend!.api

const OPTIONS: { value: AdvancementMode; title: string; text: string; icon: typeof Hand }[] = [
  {
    value: 'MANUAL',
    title: 'Manual — admin decides',
    text: 'Results never move anyone. You place any player (winners or not) into each next-round match from the Advance players panel.',
    icon: Hand,
  },
  {
    value: 'AUTO',
    title: 'Automatic',
    text: 'Winners are placed into the next round for you the moment a result is saved. You can still change a slot before that match is played.',
    icon: Zap,
  },
]

/** Switches how players reach the next round. Saved immediately. */
export function AdvancementModeSwitch() {
  const { settings } = useTournament()
  const run = useAdminAction()
  const [busy, setBusy] = useState(false)

  const choose = async (value: AdvancementMode) => {
    if (value === settings.advancement_mode || busy) return
    setBusy(true)
    await run(
      () => api.updateSettings({ ...settings, advancement_mode: value }),
      value === 'MANUAL' ? 'Manual mode: you decide who goes to the next round.' : 'Automatic mode: winners advance by themselves.',
    )
    setBusy(false)
  }

  return (
    <div role="radiogroup" aria-label="How players reach the next round" className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map(({ value, title, text, icon: Icon }) => {
        const on = settings.advancement_mode === value
        return (
          <button
            key={value}
            role="radio"
            aria-checked={on}
            disabled={busy}
            onClick={() => void choose(value)}
            className={`flex items-start gap-3 px-4 py-3.5 text-left ring-1 ring-inset transition-colors ${
              on ? 'bg-pitch/[0.09] ring-pitch/60' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'
            }`}
          >
            <Icon size={18} className={`mt-1 shrink-0 ${on ? 'text-pitch' : 'text-mute'}`} />
            <span>
              <span className={`display block text-xl ${on ? 'text-white' : 'text-soft'}`}>{title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-mute">{text}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
