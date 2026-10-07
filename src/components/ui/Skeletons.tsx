const Bar = ({ className = '' }: { className?: string }) => <div className={`skeleton ${className}`} />

export function StandingsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="panel p-3 sm:p-4" aria-busy="true" aria-label="Loading standings">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-white/[0.04] px-2 py-3.5 last:border-0">
          <Bar className="h-5 w-7" />
          <Bar className="h-10 w-10" />
          <Bar className="h-5 flex-1 max-w-[220px]" />
          <Bar className="hidden h-5 w-10 sm:block" />
          <Bar className="hidden h-5 w-10 sm:block" />
          <Bar className="ml-auto h-6 w-12" />
        </div>
      ))}
    </div>
  )
}

export function PlayerCardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel overflow-hidden p-4">
          <Bar className="aspect-[4/3] w-full" />
          <Bar className="mt-4 h-6 w-3/4" />
          <Bar className="mt-2 h-3 w-1/2" />
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Bar className="h-10" />
            <Bar className="h-10" />
            <Bar className="h-10" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MatchCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel p-5">
          <Bar className="h-3 w-32" />
          <div className="mt-5 space-y-3">
            <Bar className="h-7 w-full" />
            <Bar className="h-7 w-5/6" />
          </div>
          <Bar className="mt-5 h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function BracketSkeleton() {
  return (
    <div className="flex gap-14 overflow-hidden" aria-busy="true" aria-label="Loading bracket">
      {[4, 2, 1].map((n, c) => (
        <div key={c} className="flex w-[248px] shrink-0 flex-col justify-around gap-6" style={{ minHeight: 480 }}>
          <Bar className="h-4 w-28" />
          {Array.from({ length: n }).map((_, i) => (
            <Bar key={i} className="h-[92px] w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function StatTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Bar key={i} className="h-24" />
      ))}
    </div>
  )
}
