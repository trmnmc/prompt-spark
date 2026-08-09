/**
 * Pack registry — the single place that assembles the four subject packs
 * into a lookup table, plus the pure filtering/lens helpers that later
 * layers (generate(), Brain Scout) consume. See T-004.
 */
import type { Filters, Subject, Template } from '../core/types'
import type { SubjectPack } from './schema'
import { pack as realEstate } from './realEstate'
import { pack as law } from './law'
import { pack as finance } from './finance'
import { pack as science } from './science'

/** All four subject packs, keyed by subject. */
export const PACKS: Record<Subject, SubjectPack> = {
  realEstate,
  law,
  finance,
  science,
}

/** Every subject the registry knows about. */
export const ALL_SUBJECTS: Subject[] = Object.keys(PACKS) as Subject[]

/**
 * Conjunctive template filter. An absent `subject` or `difficulty` field
 * matches everything for that dimension. Pure: no mutation, no I/O.
 */
export function getTemplates(filters: Filters): Template[] {
  const subjects = filters.subject ? [filters.subject] : ALL_SUBJECTS
  const results: Template[] = []
  for (const subject of subjects) {
    for (const template of PACKS[subject].templates) {
      if (filters.difficulty && template.difficulty !== filters.difficulty) continue
      results.push(template)
    }
  }
  return results
}

/** The lens list for a given subject. */
export function getLenses(subject: Subject): string[] {
  return PACKS[subject].lenses
}

/** Every lens across every subject, flattened with subject attribution. */
export const ALL_LENSES: { subject: Subject; lens: string }[] = ALL_SUBJECTS.flatMap((subject) =>
  PACKS[subject].lenses.map((lens) => ({ subject, lens })),
)
