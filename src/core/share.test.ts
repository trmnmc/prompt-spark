import { describe, expect, it } from 'vitest'

import { decodeShare, encodeShare, type ShareState } from './share'

function roundtrip(state: ShareState) {
  return decodeShare(encodeShare(state))
}

describe('encodeShare / decodeShare roundtrip', () => {
  it('round-trips an empty-filter state', () => {
    const state: ShareState = { seed: 42, filters: {} }
    expect(roundtrip(state)).toEqual(state)
  })

  it('round-trips a subject-only filter state', () => {
    const state: ShareState = { seed: 7, filters: { subject: 'law' } }
    expect(roundtrip(state)).toEqual(state)
  })

  it('round-trips a difficulty-only filter state', () => {
    const state: ShareState = { seed: 1000, filters: { difficulty: 'hard' } }
    expect(roundtrip(state)).toEqual(state)
  })

  it('round-trips an all-filters state (subject + difficulty)', () => {
    const state: ShareState = {
      seed: 123,
      filters: { subject: 'finance', difficulty: 'easy' },
    }
    expect(roundtrip(state)).toEqual(state)
  })

  it('round-trips every subject value', () => {
    const subjects: ShareState['filters']['subject'][] = [
      'realEstate',
      'law',
      'finance',
      'science',
    ]
    for (const subject of subjects) {
      const state: ShareState = { seed: 1, filters: { subject } }
      expect(roundtrip(state)).toEqual(state)
    }
  })

  it('round-trips every difficulty value', () => {
    const difficulties: ShareState['filters']['difficulty'][] = [
      'easy',
      'medium',
      'hard',
    ]
    for (const difficulty of difficulties) {
      const state: ShareState = { seed: 1, filters: { difficulty } }
      expect(roundtrip(state)).toEqual(state)
    }
  })

  it('round-trips a seed of zero and a negative seed', () => {
    expect(roundtrip({ seed: 0, filters: {} })).toEqual({ seed: 0, filters: {} })
    expect(roundtrip({ seed: -5, filters: {} })).toEqual({ seed: -5, filters: {} })
  })
})

describe('encodeShare', () => {
  it('produces a URLSearchParams-style string with seed and both filters', () => {
    const qs = encodeShare({
      seed: 123,
      filters: { subject: 'law', difficulty: 'easy' },
    })
    expect(qs).toBe('seed=123&subject=law&difficulty=easy')
  })

  it('omits filter keys entirely when absent', () => {
    const qs = encodeShare({ seed: 5, filters: {} })
    expect(qs).toBe('seed=5')
    expect(qs).not.toContain('subject')
    expect(qs).not.toContain('difficulty')
  })
})

describe('decodeShare malformed input', () => {
  it('returns null when the seed param is missing', () => {
    expect(decodeShare('subject=law')).toBeNull()
  })

  it('returns null for an empty query string', () => {
    expect(decodeShare('')).toBeNull()
  })

  it('returns null when seed is empty', () => {
    expect(decodeShare('seed=')).toBeNull()
  })

  it('returns null when seed is non-numeric', () => {
    expect(decodeShare('seed=abc')).toBeNull()
  })

  it('returns null when seed is a non-integer number', () => {
    expect(decodeShare('seed=12.5')).toBeNull()
  })

  it('returns null when seed is not a safe integer', () => {
    expect(decodeShare('seed=99999999999999999999')).toBeNull()
  })
})

describe('decodeShare unknown enum values', () => {
  // Chosen behavior: unknown subject/difficulty values are rejected
  // outright (decodeShare returns null) rather than being stripped and
  // otherwise passing the rest of the state through.
  it('returns null for an unknown subject value', () => {
    expect(decodeShare('seed=1&subject=astrology')).toBeNull()
  })

  it('returns null for an unknown difficulty value', () => {
    expect(decodeShare('seed=1&difficulty=impossible')).toBeNull()
  })

  it('returns null for an unknown subject even with a valid difficulty', () => {
    expect(decodeShare('seed=1&subject=astrology&difficulty=easy')).toBeNull()
  })
})
