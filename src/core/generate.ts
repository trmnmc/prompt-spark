/**
 * generate(seed, filters) — the deterministic correctness core. See T-005.
 *
 * PURE: same seed + same filters => string-identical GeneratedPrompt,
 * stable across runs and platforms. No Date, no Math.random, no
 * locale-dependent APIs. Filtering is delegated to the registry's
 * getTemplates (conjunctive subject AND difficulty; absent field = all).
 */
import type { Filters, GeneratedPrompt } from './types'
import { DIFFICULTY_TO_TIME } from './types'
import { getTemplates } from '../data/index'
import { mulberry32, promptId, serialFromId } from './rng'

/** Matches a single `{slot}` placeholder; group 1 is the slot name. */
const SLOT_RE = /\{([^{}]+)\}/g

/**
 * Trims trailing whitespace and ensures the text ends in a terminal mark
 * (. ! or ?), appending '.' if none is present. Pure, no rand() consumed.
 * Used at generate()'s single assembly point so every prompt reads as two
 * complete sentences (T-020) without ever editing template data.
 */
function withTerminalPunctuation(text: string): string {
  const trimmed = text.replace(/\s+$/, '')
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

export function generate(seed: number, filters: Filters): GeneratedPrompt {
  const pool = getTemplates(filters)
  if (pool.length === 0) {
    throw new Error(
      `generate(): no templates match filters ` +
        `subject=${filters.subject ?? '(all)'} difficulty=${filters.difficulty ?? '(all)'}`,
    )
  }

  const rand = mulberry32(seed)
  const template = pool[Math.floor(rand() * pool.length)]

  // DETERMINISTIC ORDERING RULE: slots are resolved in order of FIRST
  // APPEARANCE in template.text (left to right). Each distinct slot name
  // consumes exactly one rand() to pick its option; repeated occurrences
  // of the same slot reuse that pick. This ordering is part of the
  // determinism contract — do not reorder.
  const picks = new Map<string, string>()
  for (const match of template.text.matchAll(SLOT_RE)) {
    const slot = match[1]
    if (picks.has(slot)) continue
    const options = template.vars[slot]
    if (!options || options.length === 0) {
      throw new Error(`generate(): template '${template.id}' has no options for slot '{${slot}}'`)
    }
    picks.set(slot, options[Math.floor(rand() * options.length)])
  }
  const resolved = template.text.replace(SLOT_RE, (_whole, slot: string) => picks.get(slot) ?? '')

  // Exactly one twist, always, appended as a new sentence.
  const twist = template.twists[Math.floor(rand() * template.twists.length)]

  // TERMINAL PUNCTUATION RULE (T-020): every generated prompt must read as
  // two well-formed sentences. Some template bodies/twists in the data
  // omit trailing punctuation, which otherwise produces a run-on like
  // "...plain language Twist: Let users...". Normalize both halves here,
  // at the single assembly point, without touching template data.
  const body = withTerminalPunctuation(resolved)
  const twistText = withTerminalPunctuation(twist)
  const text = `${body} Twist: ${twistText}`

  const id = promptId(seed, template.id)

  return {
    id,
    text,
    subject: template.subject,
    difficulty: template.difficulty,
    timeBand: DIFFICULTY_TO_TIME[template.difficulty],
    seed,
    templateId: template.id,
    serial: serialFromId(id),
  }
}
