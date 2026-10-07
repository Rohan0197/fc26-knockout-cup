import { PageHeader } from '../components/ui/PageHeader'
import { FixtureList } from '../components/FixtureList'

export default function FixturesPage() {
  return (
    <>
      <PageHeader eyebrow="Match schedule" title="Fixtures & results">
        Every knockout match, round by round. Results update live as soon as they are confirmed.
      </PageHeader>
      <FixtureList />
    </>
  )
}
