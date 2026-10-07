import { PageHeader } from '../components/ui/PageHeader'
import { KnockoutBracket } from '../components/KnockoutBracket'

export default function BracketPage() {
  return (
    <>
      <PageHeader eyebrow="The road to the final" title="Knockout bracket">
        Winners advance automatically. Lit paths show who has already gone through.
      </PageHeader>
      <KnockoutBracket />
    </>
  )
}
