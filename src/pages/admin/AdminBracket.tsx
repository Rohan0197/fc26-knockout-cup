import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarPlus, Trash2 } from 'lucide-react'
import { backend } from '../../lib/api'
import { isBracketMatch } from '../../lib/bracket'
import { useTournament } from '../../context/TournamentContext'
import { useAdminAction } from '../../hooks/useAdminAction'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { AdvancePlayers } from '../../components/admin/AdvancePlayers'
import { AdvancementModeSwitch } from '../../components/admin/AdvancementModeSwitch'
import { UpgradeNotice } from '../../components/admin/UpgradeNotice'
import { KnockoutBracket } from '../../components/KnockoutBracket'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

const api = backend!.api

function NoBracketYet() {
  const { players } = useTournament()
  return (
    <div className="panel p-6 sm:p-8">
      <div className="eyebrow mb-1 !text-[0.72rem]">No fixtures yet</div>
      <h2 className="display text-3xl text-white">The bracket is built from your fixtures</h2>
      <p className="mt-2 max-w-2xl text-sm text-soft">
        There is no automatic draw. Add each first-round match yourself under Fixtures ({players.length} players added so far). Create the
        later rounds' matches there too (players can stay TBD), then use Advance players here to decide who goes through.
      </p>
      <Link to="/admin/fixtures" className="btn btn-primary mt-5 inline-flex">
        <CalendarPlus size={16} /> Add fixtures
      </Link>
    </div>
  )
}

export default function AdminBracket() {
  const { matches, tournament, schemaReady } = useTournament()
  const run = useAdminAction()
  const [resetting, setResetting] = useState(false)
  const hasBracket = matches.some(isBracketMatch) // extra matches alone don't make a bracket
  const onlyOneRound = new Set(matches.filter(isBracketMatch).map((m) => m.round)).size === 1

  return (
    <>
      <AdminPageHeader
        title="Bracket"
        subtitle="This is exactly what the public sees. Fixtures decide the first round; you decide who advances."
      />

      <UpgradeNotice feature="Choosing who goes to the next round, finishing the bracket" />
      {schemaReady && (
        <div className="panel mb-6 p-4 sm:p-5">
          <h2 className="display mb-3 text-2xl text-white">Who goes to the next round?</h2>
          <AdvancementModeSwitch />
        </div>
      )}

      {!hasBracket ? (
        <NoBracketYet />
      ) : (
        <>
          <KnockoutBracket />
          {onlyOneRound && (
            <div className="panel mt-6 p-5 text-sm text-soft">
              Only the first round exists so far. Create the next round's matches under{' '}
              <Link to="/admin/fixtures" className="text-pitch underline">Fixtures</Link> (leave the players as TBD), then place who goes
              through here.
            </div>
          )}
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
          to 0–0. The public site will show "Fixtures pending" until you add new fixtures.
        </p>
      </ConfirmDialog>
    </>
  )
}
