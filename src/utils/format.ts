import type { MatchStatus } from '../types'

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const DAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export const fmtDay = (iso: string | null) => (iso ? DAY.format(new Date(iso)).toUpperCase() : null)
export const fmtDayLong = (iso: string | null) => (iso ? DAY_LONG.format(new Date(iso)).toUpperCase() : null)
export const fmtDate = (iso: string | null) => (iso ? DATE.format(new Date(iso)).toUpperCase() : null)
export const fmtTime = (iso: string | null) => (iso ? TIME.format(new Date(iso)).toUpperCase() : null)

/** "SAT • 7:30 PM" or "TIME TBC" */
export function fmtKickoff(iso: string | null) {
  if (!iso) return 'TIME TBC'
  return `${fmtDay(iso)} • ${fmtTime(iso)}`
}

/** Split an ISO timestamp into values for <input type=date> and <input type=time> (local time). */
export function toDateTimeInputs(iso: string | null) {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

export function fromDateTimeInputs(date: string, time: string): string | null {
  if (!date) return null
  const d = new Date(`${date}T${time || '00:00'}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  UPCOMING: 'UPCOMING',
  LIVE: 'LIVE',
  COMPLETED: 'FULL TIME',
  CANCELLED: 'CANCELLED',
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export const pad2 = (n: number) => String(n).padStart(2, '0')

export function suggestShortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return parts[0].replace(/[^\p{L}\p{N}]/gu, '').slice(0, 12).toUpperCase()
}
