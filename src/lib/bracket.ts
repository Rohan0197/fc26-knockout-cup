import type { Match, Round } from '../types'

/** Rounds in playing order. */
export const ROUND_ORDER: Round[] = ['ROUND_OF_64', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL']

export const ROUND_LABEL: Record<Round, string> = {
  ROUND_OF_64: 'Round of 64',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINAL: 'Quarter Final',
  SEMI_FINAL: 'Semi Final',
  FINAL: 'Final',
  EXTRA: 'Extra Matches',
}

/** Extra matches sit after the bracket rounds and are never part of the bracket tree. */
export const roundIndex = (r: Round) => (r === 'EXTRA' ? ROUND_ORDER.length : ROUND_ORDER.indexOf(r))
export const isBracketMatch = (m: { round: Round }) => m.round !== 'EXTRA'

export function nextRound(r: Round): Round | null {
  const i = roundIndex(r)
  return i >= 0 && i < ROUND_ORDER.length - 1 ? ROUND_ORDER[i + 1] : null
}

export const MIN_BRACKET_PLAYERS = 2
export const MAX_BRACKET_PLAYERS = 64

/** Name of a round from how many participants it starts with: 54 -> Round of 64, 27 -> Round of 32 ... Mirrors stage_round() in SQL. */
export function stageRound(participants: number): Round {
  if (participants <= 2) return 'FINAL'
  if (participants <= 4) return 'SEMI_FINAL'
  if (participants <= 8) return 'QUARTER_FINAL'
  if (participants <= 16) return 'ROUND_OF_16'
  if (participants <= 32) return 'ROUND_OF_32'
  return 'ROUND_OF_64'
}

/** One match of a freshly generated bracket, before it has a database id. */
export interface SkeletonMatch {
  key: string
  round: Round
  match_number: number
  player1_id: string | null
  player2_id: string | null
  /** key of the match the winner goes to (null for the final) */
  nextKey: string | null
  nextSlot: 1 | 2 | null
}

/**
 * Builds a whole empty bracket for 2..64 players. Mirrors generate_bracket() in SQL exactly:
 *  - everyone plays in the first round: pairs (1,2), (3,4) ...
 *  - when a round has an ODD number of participants, the winner of its LAST match skips the next round (a bye),
 *    so a bye only appears when it is unavoidable
 *  - total matches is always players - 1
 */
export function buildBracketSkeleton(playerIds: string[]): SkeletonMatch[] {
  const n = playerIds.length
  if (n < MIN_BRACKET_PLAYERS || n > MAX_BRACKET_PLAYERS)
    throw new Error(`A knockout bracket needs between ${MIN_BRACKET_PLAYERS} and ${MAX_BRACKET_PLAYERS} players (got ${n}).`)

  type Src = { player: string } | { key: string }
  let src: Src[] = playerIds.map((player) => ({ player }))
  const out: SkeletonMatch[] = []
  const byKey = new Map<string, SkeletonMatch>()

  while (src.length >= 2) {
    const p = src.length
    const round = stageRound(p)
    const m = Math.floor(p / 2)
    const next: Src[] = []
    for (let i = 1; i <= m; i++) {
      const a = src[2 * i - 2]
      const b = src[2 * i - 1]
      const match: SkeletonMatch = {
        key: `${round}:${i}`,
        round,
        match_number: i,
        player1_id: 'player' in a ? a.player : null,
        player2_id: 'player' in b ? b.player : null,
        nextKey: null,
        nextSlot: null,
      }
      out.push(match)
      byKey.set(match.key, match)
      if ('key' in a) Object.assign(byKey.get(a.key)!, { nextKey: match.key, nextSlot: 1 })
      if ('key' in b) Object.assign(byKey.get(b.key)!, { nextKey: match.key, nextSlot: 2 })
      next.push({ key: match.key })
    }
    if (p % 2 === 1) next.push(src[p - 1]) // the bye
    src = next
  }
  return out
}

/** Summary used by the admin preview: matches per round, byes, and anyone placed straight into a later round. */
export function describeBracket(skeleton: SkeletonMatch[]) {
  const rounds = ROUND_ORDER.filter((r) => skeleton.some((m) => m.round === r))
  const byKey = new Map(skeleton.map((m) => [m.key, m]))
  const plan = rounds.map((round) => ({ round, matches: skeleton.filter((m) => m.round === round).length, byes: 0 }))
  for (const m of skeleton) {
    const target = m.nextKey ? byKey.get(m.nextKey) : null
    if (!target) continue
    const from = rounds.indexOf(m.round)
    const to = rounds.indexOf(target.round)
    for (let i = from + 1; i < to; i++) plan[i].byes++
  }
  const firstRound = rounds[0]
  const earlyPlayers = skeleton
    .filter((m) => m.round !== firstRound)
    .flatMap((m) => [m.player1_id, m.player2_id])
    .filter((x): x is string => Boolean(x))
  return { plan, firstRound, earlyPlayers }
}

/* ------------------------------------------------------------------ finishing a bracket around existing fixtures */

export interface CompletionPlan {
  firstRound: Round
  /** NEW first-round fixtures made from players who were not in any fixture yet */
  newPairs: { match_number: number; player1_id: string; player2_id: string }[]
  /** an odd player out: waits for the second round (a bye) */
  carriedPlayer: string | null
  /** every match of the later rounds that will be created */
  later: SkeletonMatch[]
  /** winner-goes-to links to set on first-round matches (existing ones by id, new ones by key `new:<number>`) */
  firstLinks: { id?: string; key?: string; nextKey: string; nextSlot: 1 | 2 }[]
  /** per round: matches (existing + new) and byes, for the preview */
  plan: { round: Round; matches: number; byes: number }[]
  totalMatches: number
}

/**
 * Plans the rest of a bracket around first-round fixtures that already exist (they are never changed).
 * Mirrors complete_bracket() in SQL: unplaced players are paired into new first-round fixtures, then the later rounds
 * are built with the same bye rule as generate_bracket(). Throws a readable error when the numbers don't fit.
 */
export function planCompletion(existingFirst: Match[], unplaced: string[]): CompletionPlan {
  if (existingFirst.length === 0) throw new Error('There are no first-round fixtures yet.')
  const sorted = existingFirst.slice().sort((a, b) => a.match_number - b.match_number)
  const firstRound = sorted[0].round
  const k = sorted.length
  const extraPairs = Math.floor(unplaced.length / 2)
  const carried = unplaced.length % 2 === 1 ? unplaced[unplaced.length - 1] : null
  const totalPlayers = 2 * (k + extraPairs) + (carried ? 1 : 0)
  if (stageRound(totalPlayers) !== firstRound)
    throw new Error(
      `The first round is "${ROUND_LABEL[firstRound]}", but ${k} fixtures plus ${unplaced.length} unpaired players (${totalPlayers} players in all) would make it "${ROUND_LABEL[stageRound(totalPlayers)]}". Add the missing players or fixtures first.`,
    )

  type Src = { kind: 'first'; id?: string; key?: string } | { kind: 'later'; key: string } | { kind: 'player'; id: string }
  let nextNo = sorted[sorted.length - 1].match_number
  const newPairs: CompletionPlan['newPairs'] = []
  let src: Src[] = sorted.map((m) => ({ kind: 'first', id: m.id }))
  for (let i = 0; i < extraPairs; i++) {
    nextNo++
    newPairs.push({ match_number: nextNo, player1_id: unplaced[2 * i], player2_id: unplaced[2 * i + 1] })
    src.push({ kind: 'first', key: `new:${nextNo}` })
  }
  if (carried) src.push({ kind: 'player', id: carried })
  if (src.length < 2) throw new Error('A bracket needs at least two matches or players to continue from.')

  const later: SkeletonMatch[] = []
  const laterByKey = new Map<string, SkeletonMatch>()
  const firstLinks: CompletionPlan['firstLinks'] = []
  while (src.length >= 2) {
    const p = src.length
    const round = stageRound(p)
    const m = Math.floor(p / 2)
    const next: Src[] = []
    for (let i = 1; i <= m; i++) {
      const key = `${round}:${i}`
      const a = src[2 * i - 2]
      const b = src[2 * i - 1]
      const match: SkeletonMatch = {
        key,
        round,
        match_number: i,
        player1_id: a.kind === 'player' ? a.id : null,
        player2_id: b.kind === 'player' ? b.id : null,
        nextKey: null,
        nextSlot: null,
      }
      later.push(match)
      laterByKey.set(key, match)
      ;([[a, 1], [b, 2]] as const).forEach(([s, slot]) => {
        if (s.kind === 'first') firstLinks.push({ id: s.id, key: s.key, nextKey: key, nextSlot: slot })
        else if (s.kind === 'later') Object.assign(laterByKey.get(s.key)!, { nextKey: key, nextSlot: slot })
      })
      next.push({ kind: 'later', key })
    }
    if (p % 2 === 1) next.push(src[p - 1])
    src = next
  }

  // preview numbers: matches per round and byes (links that jump over a round)
  const rounds = [firstRound, ...ROUND_ORDER.filter((r) => later.some((m) => m.round === r))]
  const plan = rounds.map((round) => ({ round, matches: round === firstRound ? k + extraPairs : later.filter((m) => m.round === round).length, byes: 0 }))
  const roundOfKey = (key: string) => later.find((m) => m.key === key)!.round
  const jump = (fromRound: Round, toRound: Round) => {
    for (let i = rounds.indexOf(fromRound) + 1; i < rounds.indexOf(toRound); i++) plan[i].byes++
  }
  firstLinks.forEach((l) => jump(firstRound, roundOfKey(l.nextKey)))
  later.forEach((m) => m.nextKey && jump(m.round, roundOfKey(m.nextKey)))

  return { firstRound, newPairs, carriedPlayer: carried, later, firstLinks, plan, totalMatches: k + extraPairs + later.length }
}

/**
 * Where does this match's winner go? Uses the explicit link set when the bracket was generated; falls back to the
 * classic rule (match N feeds match ceil(N/2) of the next round) for hand-made fixtures. Mirrors the SQL trigger.
 */
export function resolveNext(match: Match, all: Match[]): { match: Match | undefined; slot: 1 | 2 } | null {
  if (match.next_match_id) {
    return { match: all.find((m) => m.id === match.next_match_id), slot: match.next_slot === 2 ? 2 : 1 }
  }
  const nr = nextRound(match.round)
  if (!nr) return null
  return {
    match: all.find((m) => m.round === nr && m.match_number === Math.ceil(match.match_number / 2)),
    slot: match.match_number % 2 === 1 ? 1 : 2,
  }
}

/** Rounds that actually exist in the fixtures, in playing order, each with its matches sorted. */
export function groupByRound(matches: Match[]) {
  const map = new Map<Round, Match[]>()
  for (const m of matches) {
    const list = map.get(m.round) ?? []
    list.push(m)
    map.set(m.round, list)
  }
  return [...ROUND_ORDER, 'EXTRA' as Round].filter((r) => map.has(r)).map((r) => ({
    round: r,
    matches: map.get(r)!.slice().sort((a, b) => a.match_number - b.match_number),
  }))
}

export const compareMatches = (a: Match, b: Match) =>
  roundIndex(a.round) - roundIndex(b.round) || a.match_number - b.match_number
