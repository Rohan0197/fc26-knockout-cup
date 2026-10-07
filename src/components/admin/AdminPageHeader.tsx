import type { ReactNode } from 'react'

export function AdminPageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-4xl text-white sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-mute">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
