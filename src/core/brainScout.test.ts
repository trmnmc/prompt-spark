import { describe, expect, it } from 'vitest'
import { expand } from './brainScout'
import { LADDER_RUNGS } from './types'
import { djb2 } from './rng'

/** Seeds the acceptance criteria call out explicitly. */
const SEED_PHRASES = [
  'my cool app',
  'Rent vs Buy Helper', // mixed-case multi-word
  "grandma's recipe-box, v2!", // punctuation-heavy
]

const HEX_UPPER = /^[0-9A-F]+$/

describe('expand — rung ladder', () => {
  it('returns exactly 4 rungs in exact LADDER_RUNGS order', () => {
    const result = expand('my cool app', 42)
    expect(result.rungs).toHaveLength(4)
    expect(result.rungs.map((r) => r.rung)).toEqual([...LADDER_RUNGS])
    expect(result.rungs.map((r) => r.rung)).toEqual(['Weekend', 'Week', 'Month', 'Moonshot'])
  })

  it.each(SEED_PHRASES)('every rung text contains the seed phrase verbatim: %s', (phrase) => {
    const result = expand(phrase, 7)
    expect(result.seedPhrase).toBe(phrase)
    for (const rung of result.rungs) {
      expect(rung.text).toContain(phrase)
    }
  })

  it('different seeds produce different rung texts', () => {
    const a = expand('my cool app', 1)
    const b = expand('my cool app', 2)
    expect(a.rungs.map((r) => r.text)).not.toEqual(b.rungs.map((r) => r.text))
  })
})

describe('expand — remixes', () => {
  it('returns exactly 3 remixes with 3 distinct lenses', () => {
    const result = expand('my cool app', 42)
    expect(result.remixes).toHaveLength(3)
    const lenses = result.remixes.map((r) => r.lens)
    expect(new Set(lenses).size).toBe(3)
  })

  it.each(SEED_PHRASES)('every remix text contains the seed phrase verbatim: %s', (phrase) => {
    const result = expand(phrase, 99)
    for (const remix of result.remixes) {
      expect(remix.text).toContain(phrase)
    }
  })
})

describe('expand — determinism', () => {
  it.each(SEED_PHRASES)('same phrase + seed twice is deep-equal: %s', (phrase) => {
    expect(expand(phrase, 1234)).toEqual(expand(phrase, 1234))
  })
})

describe('expand — ids', () => {
  it('rung and remix ids are uppercase hex', () => {
    const result = expand("grandma's recipe-box, v2!", 5)
    for (const rung of result.rungs) {
      expect(rung.id).toMatch(HEX_UPPER)
    }
    for (const remix of result.remixes) {
      expect(remix.id).toMatch(HEX_UPPER)
    }
  })

  it("rung id is unsigned djb2('scout:'+seedPhrase+rung) as uppercase hex", () => {
    const phrase = 'Rent vs Buy Helper'
    const result = expand(phrase, 8)
    for (const rung of result.rungs) {
      expect(rung.id).toBe(djb2(`scout:${phrase}${rung.rung}`).toString(16).toUpperCase())
    }
  })

  it("remix id is unsigned djb2('scout:'+seedPhrase+lens) as uppercase hex", () => {
    const phrase = 'my cool app'
    const result = expand(phrase, 8)
    for (const remix of result.remixes) {
      expect(remix.id).toBe(djb2(`scout:${phrase}${remix.lens}`).toString(16).toUpperCase())
    }
  })

  it('ids are stable across calls, even with different seeds', () => {
    const phrase = 'my cool app'
    const a = expand(phrase, 1)
    const b = expand(phrase, 1)
    expect(a.rungs.map((r) => r.id)).toEqual(b.rungs.map((r) => r.id))
    // Rung ids depend only on phrase + rung label, so they survive seed changes too.
    const c = expand(phrase, 999)
    expect(a.rungs.map((r) => r.id)).toEqual(c.rungs.map((r) => r.id))
  })
})
