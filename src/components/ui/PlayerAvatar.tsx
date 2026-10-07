import { useState } from 'react'
import type { Player } from '../../types'
import { cn } from '../../utils/cn'

interface Props {
  player: Pick<Player, 'name' | 'avatar_url'> | null
  /** Pixel size for the round/square avatar. Ignored when `fill` is set. */
  size?: number
  /** Fill the parent (used on player cards). */
  fill?: boolean
  className?: string
  /** Shape: sharp square with cut corner (default) or circle. */
  round?: boolean
}

/** Replaceable avatar: a real image when `avatar_url` is set, otherwise a neutral player silhouette. */
export function PlayerAvatar({ player, size = 44, fill, className, round }: Props) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(player?.avatar_url) && !failed
  const style = fill ? undefined : { width: size, height: size }

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden bg-ink-700',
        fill && 'h-full w-full',
        round ? 'rounded-full' : 'cut-tr',
        className,
      )}
      style={{ ...style, ['--cut' as string]: `${Math.max(6, Math.round(size / 5))}px` }}
      aria-hidden
    >
      {showImage ? (
        <img
          src={player!.avatar_url!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="av-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#262f3d" />
              <stop offset="1" stopColor="#12171f" />
            </linearGradient>
            <linearGradient id="av-fg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4a5568" />
              <stop offset="1" stopColor="#2a3342" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#av-bg)" />
          <circle cx="50" cy="38" r="17" fill="url(#av-fg)" />
          <path d="M14 100c0-22 15-34 36-34s36 12 36 34z" fill="url(#av-fg)" />
        </svg>
      )}
    </div>
  )
}
