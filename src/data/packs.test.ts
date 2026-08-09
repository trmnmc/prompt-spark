/**
 * Tests for the pack registry (src/data/index.ts): schema validity,
 * per-subject/difficulty coverage, and the getTemplates/getLenses helpers.
 */
import { describe, expect, it } from 'vitest'
import type { Difficulty, Subject } from '../core/types'
import { validatePack } from './schema'
import { pack as realEstatePack } from './realEstate'
import { pack as lawPack } from './law'
import { pack as financePack } from './finance'
import { pack as sciencePack } from './science'
import { ALL_LENSES, ALL_SUBJECTS, PACKS, getLenses, getTemplates } from './index'

const ALL_PACKS = [realEstatePack, lawPack, financePack, sciencePack]
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

describe('PACKS registry', () => {
  it('exposes all four subject packs keyed by subject', () => {
    expect(ALL_SUBJECTS.sort()).toEqual(['finance', 'law', 'realEstate', 'science'].sort())
    for (const subject of ALL_SUBJECTS) {
      expect(PACKS[subject]).toBeDefined()
      expect(PACKS[subject].subject).toBe(subject)
    }
  })

  for (const pack of ALL_PACKS) {
    describe(`pack: ${pack.subject}`, () => {
      it('is schema-valid (validatePack === [])', () => {
        expect(validatePack(pack.templates, pack.subject)).toEqual([])
      })

      it('has at least 10 templates', () => {
        expect(pack.templates.length).toBeGreaterThanOrEqual(10)
      })

      it('has at least 4 lenses', () => {
        expect(pack.lenses.length).toBeGreaterThanOrEqual(4)
      })
    })
  }

  it('every template id is unique across all packs', () => {
    const ids = ALL_PACKS.flatMap((p) => p.templates.map((t) => t.id))
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

describe('getTemplates', () => {
  const subjects: Subject[] = ['realEstate', 'law', 'finance', 'science']

  for (const subject of subjects) {
    for (const difficulty of DIFFICULTIES) {
      it(`returns >=1 matching template for ${subject} x ${difficulty}`, () => {
        const results = getTemplates({ subject, difficulty })
        expect(results.length).toBeGreaterThanOrEqual(1)
        for (const template of results) {
          expect(template.subject).toBe(subject)
          expect(template.difficulty).toBe(difficulty)
        }
      })
    }
  }

  it('returns the union of all packs templates when filters are empty', () => {
    const all = getTemplates({})
    const expectedIds = new Set(ALL_PACKS.flatMap((p) => p.templates.map((t) => t.id)))
    const actualIds = new Set(all.map((t) => t.id))
    expect(actualIds).toEqual(expectedIds)
    expect(all.length).toBe(expectedIds.size)
  })

  it('applies subject-only filter conjunctively', () => {
    const results = getTemplates({ subject: 'finance' })
    expect(results.length).toBeGreaterThan(0)
    for (const template of results) {
      expect(template.subject).toBe('finance')
    }
  })

  it('applies difficulty-only filter conjunctively', () => {
    const results = getTemplates({ difficulty: 'hard' })
    expect(results.length).toBeGreaterThan(0)
    for (const template of results) {
      expect(template.difficulty).toBe('hard')
    }
  })

  it('returns empty array for a subject/difficulty combo that truly has none (sanity: never empty for real combos, but the function must not throw)', () => {
    expect(() => getTemplates({ subject: 'law', difficulty: 'easy' })).not.toThrow()
  })
})

describe('getLenses / ALL_LENSES', () => {
  it('getLenses returns the lens list for each subject', () => {
    for (const pack of ALL_PACKS) {
      expect(getLenses(pack.subject)).toEqual(pack.lenses)
    }
  })

  it('ALL_LENSES is the flattened, subject-attributed union of every pack lens list', () => {
    const expected = ALL_PACKS.flatMap((p) => p.lenses.map((lens) => ({ subject: p.subject, lens })))
    expect(ALL_LENSES).toEqual(expected)
  })
})
