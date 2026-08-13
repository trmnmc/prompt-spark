/**
 * Shared contract types.
 *
 * The former "FROZEN Layer 1 contract — do not edit after T-001 lands" header
 * was a constraint of the overnight parallel build, where many agents needed a
 * stable target to compile against. It was never meant as a permanent rule.
 * The 2026-08-10 interview-board design supersedes it: Filters, Difficulty and
 * GeneratedPrompt now serve only cold-start generation, and Brief/Block in
 * ./brief.ts are the live model.
 */

export type Subject = 'realEstate' | 'law' | 'finance' | 'science'

export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_TO_TIME: Record<Difficulty, string> = {
  easy: '1–2 hours',
  medium: 'an evening or two (3–6 hours)',
  hard: 'a weekend+ (10+ hours)',
}

export const LADDER_RUNGS = ['Weekend', 'Week', 'Month', 'Moonshot'] as const

export type LadderRung = (typeof LADDER_RUNGS)[number]

/**
 * A prompt template. `text` contains `{slot}` placeholders resolved from
 * `vars` (each slot name maps to its candidate options). The generated
 * prompt ALWAYS appends/injects exactly one twist drawn from `twists`.
 */
export interface Template {
  id: string
  subject: Subject
  difficulty: Difficulty
  text: string
  vars: Record<string, string[]>
  twists: string[]
}

/**
 * A fully resolved prompt. `serial` is the short uppercase hex of `id`,
 * e.g. 'A4F2'. `timeBand` comes from DIFFICULTY_TO_TIME[difficulty].
 */
export interface GeneratedPrompt {
  id: string
  text: string
  subject: Subject
  difficulty: Difficulty
  timeBand: string
  seed: number
  templateId: string
  serial: string
}

/** Conjunctive filters; an absent field means "all". */
export interface Filters {
  subject?: Subject
  difficulty?: Difficulty
}

export interface ScoutRung {
  rung: LadderRung
  text: string
  id: string
}

export interface ScoutRemix {
  lens: string
  subject: Subject
  text: string
  id: string
}

export interface ScoutResult {
  seedPhrase: string
  rungs: ScoutRung[]
  remixes: ScoutRemix[]
}

/*
 * Declared function signatures — the frozen contract for implementations
 * landing in later layers (src/core / src/state):
 *
 *   mulberry32(seed: number): () => number
 *     Deterministic PRNG; returns a function yielding floats in [0, 1).
 *
 *   djb2(s: string): number
 *     Deterministic string hash (unsigned 32-bit).
 *
 *   promptId(seed: number, templateId: string): string
 *     Stable id for a (seed, template) pair.
 *
 *   generate(seed: number, filters: Filters): GeneratedPrompt
 *     Seeded, deterministic prompt generation honoring conjunctive filters.
 *
 *   expand(seedPhrase: string, seed: number): ScoutResult
 *     Brain Scout: 4-rung ladder + 3 lens remixes for a seed phrase.
 */
export type Mulberry32 = (seed: number) => () => number
export type Djb2 = (s: string) => number
export type PromptIdFn = (seed: number, templateId: string) => string
export type GenerateFn = (seed: number, filters: Filters) => GeneratedPrompt
export type ExpandFn = (seedPhrase: string, seed: number) => ScoutResult

/** localStorage key for favorites persistence. */
export const FAVORITES_KEY = 'prompt-spark:favorites:v1'

export type Favorite =
  | { kind: 'prompt'; prompt: GeneratedPrompt }
  | { kind: 'scout'; label: string; text: string; id: string }
