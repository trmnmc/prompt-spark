/**
 * Share-link core: pure encode/decode between (seed, filters) app state
 * and a URL query string. No DOM/window access — uses URLSearchParams,
 * which is available in both Node and the browser.
 */

import type { Difficulty, Filters, Subject } from './types'

const SUBJECTS: readonly Subject[] = ['realEstate', 'law', 'finance', 'science']
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

function isSubject(value: string): value is Subject {
  return (SUBJECTS as readonly string[]).includes(value)
}

function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value)
}

export interface ShareState {
  seed: number
  filters: Filters
}

/**
 * Encode seed+filters into a URLSearchParams-style query string (no
 * leading '?'). Absent filter keys are simply omitted from the string.
 */
export function encodeShare(state: ShareState): string {
  const params = new URLSearchParams()
  params.set('seed', String(state.seed))
  if (state.filters.subject !== undefined) {
    params.set('subject', state.filters.subject)
  }
  if (state.filters.difficulty !== undefined) {
    params.set('difficulty', state.filters.difficulty)
  }
  return params.toString()
}

/**
 * Decode a query string back into { seed, filters }.
 *
 * Returns null when the seed param is missing/empty or is not an
 * integer. An unknown subject or difficulty value also causes a null
 * result — invalid values are rejected outright rather than being
 * silently stripped or passed through unchecked.
 *
 * A filter param that is simply absent from the query string produces
 * an absent key on the returned `filters` object (not an explicit
 * `undefined` value), so a decode of an encode round-trips by
 * deep-equality.
 */
export function decodeShare(qs: string): ShareState | null {
  const params = new URLSearchParams(qs)

  const rawSeed = params.get('seed')
  if (rawSeed === null || rawSeed === '') return null
  if (!/^-?\d+$/.test(rawSeed)) return null
  const seed = Number(rawSeed)
  if (!Number.isSafeInteger(seed)) return null

  const filters: Filters = {}

  const rawSubject = params.get('subject')
  if (rawSubject !== null) {
    if (!isSubject(rawSubject)) return null
    filters.subject = rawSubject
  }

  const rawDifficulty = params.get('difficulty')
  if (rawDifficulty !== null) {
    if (!isDifficulty(rawDifficulty)) return null
    filters.difficulty = rawDifficulty
  }

  return { seed, filters }
}
