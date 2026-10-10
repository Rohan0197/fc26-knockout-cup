import { Users } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Standings } from '../components/Standings'
import { EmptyState } from '../components/ui/EmptyState'
import { StandingsSkeleton } from '../components/ui/Skeletons'
import { useStandings } from '../hooks/useStandings'

export default function StandingsPage() {
  const { standings, loading } = useStandings()
  return (
    <>
      <PageHeader eyebrow="The race to the title" title="Tournament standings">
        Win = 1 point · Loss = 0. Every match counts, including any extra matches the organisers add.
      </PageHeader>
      {loading ? (
        <StandingsSkeleton />
      ) : standings.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="No players yet"
          message="Standings will appear here once players have been added to the tournament."
        />
      ) : (
        <Standings standings={standings} />
      )}
    </>
  )
}
