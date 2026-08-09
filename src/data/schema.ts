/**
 * FROZEN Layer 1 data schema for Prompt Spark subject packs.
 * Do not edit after T-001 lands.
 */
import type { Subject, Template } from '../core/types'

/** A pack entry is exactly a Template. */
export type PackEntry = Template

/** Brain Scout lenses for a subject; each SubjectPack carries >= 3. */
export type LensList = string[]

export interface SubjectPack {
  subject: Subject
  label: string
  templates: Template[]
  lenses: LensList
}

/**
 * Validate a pack's entries for one subject. Returns a list of human-readable
 * violations (empty array = valid). Checks, per pack:
 *   - at least 10 entries
 *   - every entry carries the expected subject
 *   - every vars slot has at least one option
 *   - every entry has at least one twist
 * NOTE: "all difficulties represented" is checked at registry level across
 * the pack, not per-entry, and is intentionally NOT checked here.
 */
export function validatePack(entries: Template[], subject: Subject): string[] {
  const violations: string[] = []
  if (entries.length < 10) {
    violations.push(`pack for '${subject}' has ${entries.length} entries; needs at least 10`)
  }
  for (const entry of entries) {
    if (entry.subject !== subject) {
      violations.push(`template '${entry.id}': subject '${entry.subject}' does not match pack subject '${subject}'`)
    }
    for (const [slot, options] of Object.entries(entry.vars)) {
      if (options.length === 0) {
        violations.push(`template '${entry.id}': var slot '${slot}' has no options`)
      }
    }
    if (entry.twists.length < 1) {
      violations.push(`template '${entry.id}': needs at least one twist`)
    }
  }
  return violations
}
