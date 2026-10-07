import type { ReactNode } from 'react'

interface Props {
  label: string
  error?: string | null
  hint?: string
  children: ReactNode
  className?: string
}

export function Field({ label, error, hint, children, className }: Props) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="label mb-1.5 block text-[0.74rem] text-mute">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-mute">{hint}</span>
      ) : null}
    </label>
  )
}
