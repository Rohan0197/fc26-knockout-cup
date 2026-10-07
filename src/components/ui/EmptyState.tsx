import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Props {
  icon: ReactNode
  title: string
  message: string
  action?: ReactNode
  compact?: boolean
}

/** Professional empty state - used instead of fake data whenever there is nothing to show yet. */
export function EmptyState({ icon, title, message, action, compact }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`panel flex flex-col items-center text-center ${compact ? 'px-6 py-10' : 'px-6 py-16 sm:py-20'}`}
    >
      <div className="mb-5 grid h-14 w-14 place-items-center border border-white/10 bg-white/[0.03] text-pitch">
        {icon}
      </div>
      <h3 className="display text-3xl text-white sm:text-4xl">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-mute">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  )
}
