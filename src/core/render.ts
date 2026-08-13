/**
 * Brief -> draft prose. Pure and deterministic: the draft is a concatenation
 * of frozen per-block sentences, which is what makes the draft grow stably
 * on screen instead of rewording itself under the reader.
 */
import type { BlockKind, Brief } from './brief'

const TEMPLATES: Partial<Record<BlockKind, (answer: string) => string>> = {
  intent: (a) => `Build ${a}`,
  whoFor: (a) => `It's for ${a}`,
  hardPart: (a) => `The hard part is ${a}`,
  inputs: (a) => `It works from ${a}`,
  scope: (a) => `Scope it to ${a}`,
  wontDo: (a) => `Deliberately leave out ${a}`,
}

/**
 * Degraded no-key path only. Whenever a key is present, interview.ts asks the
 * model to write the sentence — template prose is the thing this redesign
 * exists to get away from.
 */
export function templateSentence(kind: BlockKind, label: string, answer: string): string {
  const trimmed = answer.trim().replace(/\.$/, '')
  const make = TEMPLATES[kind]
  return make ? `${make(trimmed)}.` : `${label}: ${trimmed}.`
}

/**
 * The seed idea is an IMPLICIT intent block: it leads the draft until a real
 * `intent` block supersedes it. Without this the user's own words silently
 * drop out of their prompt the moment any other block lands.
 */
export function renderDraft(brief: Brief): string {
  const sentences = brief.blocks.map((b) => b.sentence.trim()).filter((s) => s !== '')
  const hasIntent = brief.blocks.some((b) => b.kind === 'intent' && b.sentence.trim() !== '')
  if (!hasIntent) {
    sentences.unshift(templateSentence('intent', 'Intent', brief.seedIdea))
  }
  return sentences.join(' ')
}
