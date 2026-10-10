import { PageHeader } from '../components/ui/PageHeader'
import { KnockoutBracket } from '../components/KnockoutBracket'

export default function BracketPage() {
  return (
    <>
      <PageHeader eyebrow="The road to the final" title="Knockout bracket">
        Green lines mark finished matches. The organisers decide who goes through to each next round.
      </PageHeader>
      <KnockoutBracket />
    </>
  )
}
