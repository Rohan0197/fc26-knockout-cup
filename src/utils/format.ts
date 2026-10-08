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

/** "Rohan Dongre" -> "RD", "Player 02" -> "P2", "Madonna" -> "MA". Safe for non-Latin names and emoji. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const chars = (w: string) => Array.from(w)
  if (words.length === 1) return chars(words[0]).slice(0, 2).join('').toUpperCase()
  let last = words[words.length - 1]
  if (/^\d+$/.test(last)) last = String(Number(last)) // "04" -> "4"
  return (chars(words[0])[0] + chars(last)[0]).toUpperCase()
}

/** Stable colour for a player: the same name always gets the same hue. Curated so tiles look good on the dark theme. */
const AVATAR_HUES = [152, 188, 212, 250, 282, 322, 350, 14, 36, 168, 226, 300]
export function avatarHue(name: string): number {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ')
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return AVATAR_HUES[(h >>> 0) % AVATAR_HUES.length]
}

export const pad2 = (n: number) => String(n).padStart(2, '0')

export function suggestShortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return parts[0].replace(/[^\p{L}\p{N}]/gu, '').slice(0, 12).toUpperCase()
}
