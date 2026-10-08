import { memo, useMemo } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useMediaQuery } from '../hooks/useMediaQuery'

/** Deterministic pseudo-random so the crowd silhouette is stable between renders. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function useCrowd() {
  return useMemo(() => {
    const r = rng(26)
    const W = 1600
    let d = `M0 120 L0 70`
    const lights: { x: number; y: number }[] = []
    for (let x = 0; x <= W; x += 9) {
      const wave = Math.sin(x / 140) * 8 + Math.sin(x / 47) * 4
      const y = 46 + wave + r() * 20
      d += ` L${x} ${y.toFixed(1)}`
      if (r() > 0.93) lights.push({ x, y: y + 6 + r() * 10 })
    }
    d += ` L${W} 120 Z`
    return { d, lights }
  }, [])
}

/**
 * Layered, GPU-friendly stadium night scene: floodlight beams, pitch lines in perspective,
 * crowd silhouette, drifting fog and film grain. Everything is CSS / SVG - no image downloads -
 * and layers move at different rates on scroll for a subtle parallax.
 */
function StadiumBackgroundImpl() {
  const { scrollY } = useScroll()
  const beamY = useTransform(scrollY, [0, 1200], [0, 90])
  const pitchY = useTransform(scrollY, [0, 1200], [0, -60])
  const crowd = useCrowd()
  // Phones & reduced-motion users: no scroll-linked parallax (saves a JS update per scroll frame).
  const phone = useMediaQuery('(max-width: 767px)')
  const reduced = useReducedMotion() // hooks must always run, never short-circuit them
  const still = phone || Boolean(reduced)

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950 [contain:paint]">
      {/* base atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#0f1621_0%,#080b10_55%,#05070a_100%)]" />

      {/* floodlight beams */}
      <motion.div style={still ? undefined : { y: beamY }} className="absolute inset-x-0 top-0 h-[85vh]">
        <div
          className="absolute -left-[12%] -top-[20%] h-[120%] w-[55%] origin-top-left -rotate-[18deg] opacity-80"
          style={{
            background:
              'conic-gradient(from 180deg at 50% 0%, transparent 0deg, rgba(190,255,220,0.0) 160deg, rgba(190,255,220,0.26) 180deg, rgba(190,255,220,0.0) 200deg, transparent 360deg)',
            animation: 'breathe 7s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -right-[12%] -top-[20%] h-[120%] w-[55%] origin-top-right rotate-[18deg] opacity-80"
          style={{
            background:
              'conic-gradient(from 180deg at 50% 0%, transparent 0deg, rgba(190,255,220,0.0) 160deg, rgba(190,255,220,0.22) 180deg, rgba(190,255,220,0.0) 200deg, transparent 360deg)',
            animation: 'breathe 9s ease-in-out -3s infinite',
          }}
        />
        <div className="absolute left-[5%] top-[2%] h-32 w-32 rounded-full bg-white/60 blur-2xl md:blur-3xl" />
        <div className="absolute right-[5%] top-[2%] h-32 w-32 rounded-full bg-white/50 blur-2xl md:blur-3xl" />
      </motion.div>

      {/* lit horizon: stadium glow behind the stands so the crowd reads as a silhouette.
          Horizon line = 36vh + 64px; the glow, crowd and pitch all hang off it so they line up. */}
      <div className="absolute inset-x-0 top-[24vh] h-[calc(12vh+64px)] bg-[linear-gradient(to_top,rgba(120,200,160,0.20),rgba(120,160,200,0.06)_60%,transparent)]" />
      {/* pitch floor: fades in from the horizon instead of starting with a hard edge */}
      <div className="absolute inset-x-0 bottom-0 top-[calc(36vh+64px)] bg-[linear-gradient(to_bottom,transparent,rgba(14,70,44,0.36)_12%,rgba(8,36,24,0.2)_50%,transparent)]" />

      {/* pitch lines in perspective */}
      <motion.div
        style={still ? undefined : { y: pitchY }}
        className="absolute inset-x-0 bottom-0 h-[70vh] [perspective:900px] [mask-image:linear-gradient(to_top,black_20%,transparent_95%)]"
      >
        <svg
          viewBox="0 0 1000 640"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-x-[-10%] bottom-[-18%] h-full w-[120%] origin-bottom opacity-[0.18]"
          style={{ transform: 'rotateX(62deg)' }}
          fill="none"
          stroke="#2bff88"
          strokeWidth="2.2"
        >
          <rect x="40" y="20" width="920" height="600" />
          <line x1="500" y1="20" x2="500" y2="620" />
          <circle cx="500" cy="320" r="88" />
          <circle cx="500" cy="320" r="4" fill="#2bff88" />
          <rect x="40" y="170" width="150" height="300" />
          <rect x="810" y="170" width="150" height="300" />
          <rect x="40" y="245" width="60" height="150" />
          <rect x="900" y="245" width="60" height="150" />
          <path d="M190 270a60 60 0 010 100M810 270a60 60 0 000 100" />
        </svg>
        {/* mown-stripe texture */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(43,255,136,0.03)_0_80px,transparent_80px_160px)]" />
      </motion.div>

      {/* crowd silhouette: a thin skyline that dissolves downward */}
      <div className="absolute inset-x-0 top-[36vh] h-24 [mask-image:linear-gradient(to_bottom,black_0%,black_40%,transparent_100%)]">
        <svg viewBox="0 0 1600 120" preserveAspectRatio="none" className="h-full w-full">
          <path d={crowd.d} fill="#04060a" fillOpacity="0.92" />
          {crowd.lights.map((l, i) => (
            <circle key={i} cx={l.x} cy={l.y} r="1.5" fill="#cfe9ff" opacity={0.55} />
          ))}
        </svg>
      </div>

      {/* drifting fog */}
      <div
        className="absolute inset-x-[-10%] top-[20vh] hidden h-[34vh] opacity-60 blur-3xl md:block"
        style={{
          background:
            'radial-gradient(60% 60% at 30% 50%, rgba(120,160,190,0.10), transparent), radial-gradient(50% 60% at 75% 40%, rgba(43,255,136,0.05), transparent)',
          animation: 'drift 28s ease-in-out infinite',
        }}
      />

      {/* geometric overlay: faint diagonal slashes */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,transparent_0_120px,rgba(255,255,255,0.012)_120px_121px)]" />

      {/* readability vignette so content always has contrast */}
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_45%,transparent_40%,rgba(5,7,10,0.62)_100%)]" />

      {/* film grain */}
      <div className="grain absolute inset-0 hidden opacity-[0.06] mix-blend-overlay md:block" />
    </div>
  )
}

export const StadiumBackground = memo(StadiumBackgroundImpl)
