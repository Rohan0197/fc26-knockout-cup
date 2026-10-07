import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'

interface Props {
  value: number
  className?: string
  /** Left-pad with zeros to this width (e.g. 2 -> "03"). */
  pad?: number
  suffix?: string
}

/** Counts smoothly from the previous value to the new one - used for points, stats, win %. */
export function AnimatedNumber({ value, className, pad = 0, suffix = '' }: Props) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => String(Math.round(v)).padStart(pad, '0') + suffix)

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [mv, value])

  return <motion.span className={className}>{text}</motion.span>
}
