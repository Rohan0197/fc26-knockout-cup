import type { Match, Round } from '../types'

/** Rounds in playing order. */
export const ROUND_ORDER: Round[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL']

export const ROUND_LABEL: Record<Round, string> = {
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINAL: 'Quarter Final',
  SEMI_FINAL: 'Semi Final',
  FINAL: 'Final',
}

export const roundIndex = (r: Round) => ROUND_ORDER.indexOf(r)

export function nextRound(r: Round): Round | null {
  const i = roundIndex(r)
  return i >= 0 && i < ROUND_ORDER.length - 1 ? ROUND_ORDER[i + 1] : null
}

/** Match N of a round feeds match ceil(N/2) of the next, into slot 1 (odd N) or 2 (even N). */
export function advancementTarget(round: Round, matchNumber: number) {
  const next = nextRound(round)
  if (!next) return null
  return {
    round: next,
    match_number: Math.ceil(matchNumber / 2),
    slot: (matchNumber % 2 === 1 ? 1 : 2) as 1 | 2,
  }
}

export const VALID_BRACKET_SIZES = [2, 4, 8, 16] as const

export function firstRoundFor(size: number): Round | null {
  switch (size) {
    case 16: return 'ROUND_OF_16'
    case 8: return 'QUARTER_FINAL'
    case 4: return 'SEMI_FINAL'
    case 2: return 'FINAL'
    default: return null
  }
}

/** Skeleton of an empty bracket for `playerIds` (ordered pairs). Mirrors the SQL generate_bracket(). */
export function buildBracketSkeleton(playerIds: string[]) {
  const n = playerIds.length
  const first = firstRoundFor(n)
  if (!first) throw new Error(`A knockout bracket needs 2, 4, 8 or 16 players (got ${n}).`)
  const out: { round: Round; match_number: number; player1_id: string | null; player2_id: string | null }[] = []
  let round: Round | null = first
  let size = n / 2
  let isFirst = true
  while (round) {
    for (let i = 1; i <= size; i++) {
      out.push({
        round,
        match_number: i,
        player1_id: isFirst ? playerIds[2 * i - 2] : null,
        player2_id: isFirst ? playerIds[2 * i - 1] : null,
      })
    }
    isFirst = false
    round = nextRound(round)
    size = size / 2
  }
  return out
}

/** Rounds that actually exist in the fixtures, in playing order, each with its matches sorted. */
export function groupByRound(matches: Match[]) {
  const map = new Map<Round, Match[]>()
  for (const m of matches) {
    const list = map.get(m.round) ?? []
    list.push(m)
    map.set(m.round, list)
  }
  return ROUND_ORDER.filter((r) => map.has(r)).map((r) => ({
    round: r,
    matches: map.get(r)!.slice().sort((a, b) => a.match_number - b.match_number),
  }))
}

export const compareMatches = (a: Match, b: Match) =>
  roundIndex(a.round) - roundIndex(b.round) || a.match_number - b.match_number
