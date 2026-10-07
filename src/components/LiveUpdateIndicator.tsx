import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTournament } from '../context/TournamentContext'

/** Subtle broadcast-style "LIVE UPDATE" chip that flashes whenever data changes underneath the viewer. */
export function LiveUpdateIndicator() {
  const { liveTick } = useTournament()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (liveTick === 0) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3800)
    return () => clearTimeout(t)
  }, [liveTick])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 20, x: -10 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[70] max-w-[calc(100vw-2rem)] flex items-center gap-3 border-l-2 border-pitch bg-ink-900/95 py-2.5 pl-3 pr-5 shadow-[0_0_40px_rgba(43,255,136,0.18)] backdrop-blur"
        >
          <span className="live-dot" />
          <div>
            <div className="label text-[0.8rem] leading-none text-pitch">Live update</div>
            <div className="mt-1 text-xs text-soft">Standings and bracket refreshed</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
