import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Props {
  eyebrow: string
  title: string
  children?: ReactNode
  right?: ReactNode
}

export function PageHeader({ eyebrow, title, children, right }: Props) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
      <div>
        <motion.div
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="eyebrow mb-3 flex items-center gap-3"
        >
          <span className="h-px w-8 bg-pitch" />
          {eyebrow}
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="display text-[2.6rem] text-white sm:text-6xl lg:text-7xl"
        >
          {title}
        </motion.h1>
        {children && <div className="mt-3 max-w-xl text-sm text-mute sm:text-base">{children}</div>}
      </div>
      {right}
    </header>
  )
}
