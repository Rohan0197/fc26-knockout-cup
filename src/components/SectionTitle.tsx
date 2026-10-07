import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Reveal } from './ui/Reveal'

interface Props {
  eyebrow: string
  title: string
  to?: string
  cta?: string
}

export function SectionTitle({ eyebrow, title, to, cta }: Props) {
  return (
    <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <div className="eyebrow mb-2 flex items-center gap-3">
          <span className="h-px w-7 bg-pitch" />
          {eyebrow}
        </div>
        <h2 className="display text-[2.1rem] text-white xs:text-4xl sm:text-5xl">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="label group flex shrink-0 items-center gap-2 whitespace-nowrap pb-1 text-[0.85rem] text-mute transition-colors hover:text-pitch">
          {cta ?? 'View all'}
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </Reveal>
  )
}
