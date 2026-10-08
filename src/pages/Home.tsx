import { CalendarClock, ClipboardList, Users } from 'lucide-react'
import { Hero } from '../components/Hero'
import { SectionTitle } from '../components/SectionTitle'
import { MatchCard } from '../components/MatchCard'
import { Standings } from '../components/Standings'
import { KnockoutBracket } from '../components/KnockoutBracket'
import { EmptyState } from '../components/ui/EmptyState'
import { MatchCardsSkeleton, StandingsSkeleton } from '../components/ui/Skeletons'
import { useMatches } from '../hooks/useMatches'
import { useStandings } from '../hooks/useStandings'
import { Reveal } from '../components/ui/Reveal'

export default function Home() {
  const { matches, recent, next, byId, loading: matchesLoading } = useMatches()
  const { standings, loading: standingsLoading } = useStandings()
  const noFixtures = !matchesLoading && matches.length === 0

  return (
    <>
      <Hero />

      {/* WHAT'S NEXT / WHAT JUST HAPPENED */}
      <section className="mb-16 grid gap-10 lg:grid-cols-2 lg:gap-8">
        <div>
          <SectionTitle eyebrow="What's next" title="Up next" to="/fixtures" cta="All fixtures" />
          {matchesLoading ? (
            <MatchCardsSkeleton count={2} />
          ) : next.length > 0 ? (
            <div className="space-y-4">
              {next.map((m, i) => (
                <MatchCard key={m.id} match={m} byId={byId} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={<CalendarClock size={24} />}
              title={noFixtures ? 'Fixtures pending' : 'No matches scheduled'}
              message={
                noFixtures
                  ? 'Final tournament fixtures will appear here once the bracket is confirmed.'
                  : 'The next matches will appear here as soon as both players are known.'
              }
            />
          )}
        </div>

        <div>
          <SectionTitle eyebrow="Full time" title="Latest results" to="/fixtures" cta="All results" />
          {matchesLoading ? (
            <MatchCardsSkeleton count={2} />
          ) : recent.length > 0 ? (
            <div className="space-y-4">
              {recent.map((m, i) => (
                <MatchCard key={m.id} match={m} byId={byId} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={<ClipboardList size={24} />}
              title="No results yet"
              message="Match results will appear here once the tournament begins."
            />
          )}
        </div>
      </section>

      {/* LEADERBOARD PREVIEW */}
      <section className="mb-16">
        <SectionTitle eyebrow="The race to the title" title="Tournament standings" to="/standings" cta="Full standings" />
        {standingsLoading ? (
          <StandingsSkeleton rows={5} />
        ) : standings.length > 0 ? (
          <Reveal>
            <Standings standings={standings} limit={5} />
          </Reveal>
        ) : (
          <EmptyState
            compact
            icon={<Users size={24} />}
            title="No players yet"
            message="Standings will appear here once players have been added to the tournament."
          />
        )}
      </section>

      {/* BRACKET */}
      <section>
        <SectionTitle eyebrow="The road to the final" title="Knockout bracket" to="/bracket" cta="Full bracket" />
        <Reveal>
          <KnockoutBracket largeAs="rounds" />
        </Reveal>
      </section>
    </>
  )
}
