import { Users } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { PlayerCard } from '../components/PlayerCard'
import { EmptyState } from '../components/ui/EmptyState'
import { PlayerCardsSkeleton } from '../components/ui/Skeletons'
import { useStandings } from '../hooks/useStandings'

export default function PlayersPage() {
  const { standings, loading } = useStandings()
  return (
    <>
      <PageHeader eyebrow="The contenders" title="Players">
        Everyone in the tournament, ranked by points. Win = 1 point, loss = 0.
      </PageHeader>
      {loading ? (
        <PlayerCardsSkeleton />
      ) : standings.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="No players yet"
          message="Players will appear here once they have been added to the tournament."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {standings.map((s, i) => (
            <PlayerCard key={s.player.id} standing={s} index={i} />
          ))}
        </div>
      )}
    </>
  )
}
