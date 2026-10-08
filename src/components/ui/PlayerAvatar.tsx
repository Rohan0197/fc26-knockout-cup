import { useState } from 'react'
import type { Player } from '../../types'
import { cn } from '../../utils/cn'
import { avatarHue, initials } from '../../utils/format'

interface Props {
  player: Pick<Player, 'name' | 'avatar_url'> | null
  /** Pixel size for the square avatar. Ignored when `fill` is set. */
  size?: number
  /** Fill the parent (used on player cards). */
  fill?: boolean
  /** No tile behind the initials - they sit directly on the parent's artwork (player cards). */
  plain?: boolean
  className?: string
  /** Shape: sharp square with cut corner (default) or circle. */
  round?: boolean
}

/**
 * Player picture. Uses the photo when `avatar_url` is set; otherwise shows the player's initials on a
 * colour derived from their name (so every player looks distinct and keeps the same colour everywhere).
 * With no player at all (an undecided "TBD" slot) it falls back to a neutral silhouette.
 */
export function PlayerAvatar({ player, size = 44, fill, plain, className, round }: Props) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(player?.avatar_url) && !failed
  const hue = player ? avatarHue(player.name) : 0

  const tile =
    !plain && player && !showImage
      ? {
          background: `linear-gradient(145deg, hsl(${hue} 52% 30%), hsl(${hue} 58% 13%))`,
        }
      : undefined

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden bg-ink-700',
        fill && 'h-full w-full',
        round ? 'rounded-full' : 'cut-tr',
        className,
      )}
      style={{
        ...(fill ? undefined : { width: size, height: size }),
        ...tile,
        ['--cut' as string]: `${Math.max(6, Math.round(size / 5))}px`,
      }}
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
      ) : player ? (
        <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          {!plain && (
            <path d="M-10 70 L70 -10 M10 110 L110 10" stroke={`hsl(${hue} 60% 70% / 0.10)`} strokeWidth="9" fill="none" />
          )}
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={plain ? 46 : 44}
            letterSpacing="1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontStyle: 'italic',
              fill: plain ? `hsl(${hue} 70% 78% / 0.9)` : '#fff',
            }}
          >
            {initials(player.name)}
          </text>
        </svg>
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
