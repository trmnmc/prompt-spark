import { describe, expect, it } from 'vitest'
import type { Difficulty, Subject } from './types'
import { DIFFICULTY_TO_TIME } from './types'
import { djb2, mulberry32, promptId, serialFromId } from './rng'
import { generate } from './generate'
import { getTemplates } from '../data/index'

const SUBJECTS: Subject[] = ['realEstate', 'law', 'finance', 'science']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

describe('rng primitives', () => {
  it('mulberry32 yields identical sequences for identical seeds', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })

  it('mulberry32 yields floats in [0, 1)', () => {
    const rand = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('djb2 is deterministic and unsigned 32-bit', () => {
    expect(djb2('hello')).toBe(djb2('hello'))
    expect(djb2('hello')).not.toBe(djb2('hellp'))
    for (const s of ['', 'a', '42:re-01', 'a-long-string-that-overflows-32-bits-many-times']) {
      const h = djb2(s)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('promptId is the uppercase hex of djb2(`${seed}:${templateId}`)', () => {
    const id = promptId(42, 're-01')
    expect(id).toBe(djb2('42:re-01').toString(16).toUpperCase())
    expect(id).toMatch(/^[0-9A-F]+$/)
  })

  it('serialFromId takes the first 4 chars and pads short ids', () => {
    expect(serialFromId('A4F2B911')).toBe('A4F2')
    expect(serialFromId('AB')).toBe('AB00')
  })
})

describe('generate determinism', () => {
  const seeds = [0, 1, 42, 123456789, 2147483647, 4294967295]

  it.each(seeds)('seed %i: two calls are string-identical', (seed) => {
    const first = generate(seed, {})
    const second = generate(seed, {})
    expect(second.text).toBe(first.text)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('is deterministic with filters applied too', () => {
    for (const subject of SUBJECTS) {
      for (const difficulty of DIFFICULTIES) {
        const first = generate(97, { subject, difficulty })
        const second = generate(97, { subject, difficulty })
        expect(JSON.stringify(second)).toBe(JSON.stringify(first))
      }
    }
  })

  it('different seeds give different outputs', () => {
    // Probabilistic in general; these seed pairs are verified to differ.
    const pairs: [number, number][] = [
      [1, 2],
      [0, 1000],
      [42, 43],
    ]
    for (const [s1, s2] of pairs) {
      expect(generate(s1, {}).text).not.toBe(generate(s2, {}).text)
    }
  })
})

describe('generate filtering', () => {
  it('honors every subject x difficulty combo with the exact time label', () => {
    for (const subject of SUBJECTS) {
      for (const difficulty of DIFFICULTIES) {
        const prompt = generate(7, { subject, difficulty })
        expect(prompt.subject).toBe(subject)
        expect(prompt.difficulty).toBe(difficulty)
        expect(prompt.timeBand).toBe(DIFFICULTY_TO_TIME[difficulty])
      }
    }
  })

  it('emits the three fixed difficulty-to-time labels exactly', () => {
    expect(generate(11, { difficulty: 'easy' }).timeBand).toBe('1–2 hours')
    expect(generate(11, { difficulty: 'medium' }).timeBand).toBe('an evening or two (3–6 hours)')
    expect(generate(11, { difficulty: 'hard' }).timeBand).toBe('a weekend+ (10+ hours)')
  })

  it('honors a subject-only filter', () => {
    for (const subject of SUBJECTS) {
      expect(generate(23, { subject }).subject).toBe(subject)
    }
  })

  it('honors a difficulty-only filter', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(generate(23, { difficulty }).difficulty).toBe(difficulty)
    }
  })

  it('empty filters draw from all subjects (smoke over many seeds)', () => {
    const seen = new Set<Subject>()
    for (let seed = 0; seed < 200; seed++) seen.add(generate(seed, {}).subject)
    expect([...seen].sort()).toEqual([...SUBJECTS].sort())
  })
})

describe('generated prompt shape', () => {
  const samples = () => {
    const out = []
    for (let seed = 0; seed < 50; seed++) out.push(generate(seed, {}))
    for (const subject of SUBJECTS) {
      for (const difficulty of DIFFICULTIES) {
        out.push(generate(31337, { subject, difficulty }))
      }
    }
    return out
  }

  it('always includes a twist', () => {
    for (const prompt of samples()) {
      expect(prompt.text).toContain('Twist:')
    }
  })

  it('contains no unresolved { placeholders', () => {
    for (const prompt of samples()) {
      expect(prompt.text).not.toContain('{')
      expect(prompt.text).not.toContain('}')
    }
  })

  it('id is uppercase hex and serial is its 4-char prefix', () => {
    for (const prompt of samples()) {
      expect(prompt.id).toMatch(/^[0-9A-F]+$/)
      expect(prompt.serial).toHaveLength(4)
      expect(prompt.serial).toBe(serialFromId(prompt.id))
      expect(prompt.id).toBe(promptId(prompt.seed, prompt.templateId))
    }
  })
})

describe('T-020: terminal punctuation before the Twist sentence', () => {
  const TWO_SENTENCE_RE = /[.!?] Twist: /
  // A terminal mark may sit inside a trailing closing quote/paren (e.g.
  // `no survivors."`) — checking only the bare last character would also
  // pass on a malformed double terminal like `."` followed by another
  // '.', so this also rejects that shape explicitly below.
  const TERMINAL_RE = /[.!?]["')]?$/

  it('covers all 48 templates and every generated text is two well-formed sentences', () => {
    const allTemplates = getTemplates({})
    expect(allTemplates.length).toBe(48)

    // getTemplates({}) partitions into subject x difficulty buckets; draw
    // a fixed run of seeds per bucket (deterministic, no rand() beyond
    // what generate() itself consumes) and confirm every template id in
    // the bucket is actually exercised, so the assertion below is proven
    // true for all 48 templates, not just whichever the RNG favors.
    const buckets = new Map<string, Set<string>>()
    for (const template of allTemplates) {
      const key = `${template.subject}:${template.difficulty}`
      if (!buckets.has(key)) buckets.set(key, new Set())
      buckets.get(key)!.add(template.id)
    }

    for (const [key, expectedIds] of buckets) {
      const [subject, difficulty] = key.split(':') as [Subject, Difficulty]
      const seenIds = new Set<string>()
      for (let seed = 0; seed < 200; seed++) {
        const prompt = generate(seed, { subject, difficulty })
        seenIds.add(prompt.templateId)
        // Every generated prompt reads as two sentences: terminal
        // punctuation ends the body right before "Twist: " begins, and
        // the twist sentence itself ends terminally too.
        expect(prompt.text).toMatch(TWO_SENTENCE_RE)
        expect(prompt.text).toMatch(TERMINAL_RE)
        expect(prompt.text).not.toMatch(/[.!?]["')]?[.!?]$/)
      }
      expect(seenIds).toEqual(expectedIds)
    }
  })

  it('holds for the unfiltered pool across a broad range of seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const prompt = generate(seed, {})
      expect(prompt.text).toMatch(TWO_SENTENCE_RE)
      expect(prompt.text).toMatch(TERMINAL_RE)
      expect(prompt.text).not.toMatch(/[.!?]["')]?[.!?]$/)
    }
  })
})
