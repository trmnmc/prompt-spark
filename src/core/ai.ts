/**
 * AI generation — real Claude-written prompts and Brain Scout expansions,
 * using the user's own API key directly from the browser (no backend).
 *
 * Template mode remains the offline fallback: every function here returns
 * the SAME shapes as the deterministic core (GeneratedPrompt / ScoutResult),
 * so favorites, copy, and rendering are unchanged. AI results get ids from
 * djb2 over their text, exactly like scout ids, keeping the favorites
 * dedupe path identical.
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  DIFFICULTY_TO_TIME,
  LADDER_RUNGS,
  type Difficulty,
  type Filters,
  type GeneratedPrompt,
  type ScoutResult,
  type Subject,
} from './types'
import { djb2, serialFromId } from './rng'
import { getLenses, getTemplates } from '../data/index'
import type { AiModel } from '../state/settings'

const SUBJECT_LABELS: Record<Subject, string> = {
  realEstate: 'Real Estate',
  law: 'Law',
  finance: 'Finance',
  science: 'Science',
}
const ALL_SUBJECTS = Object.keys(SUBJECT_LABELS) as Subject[]
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

export class AiError extends Error {
  /** true when template fallback should kick in silently (network/API issue) */
  readonly recoverable: boolean
  constructor(message: string, recoverable: boolean) {
    super(message)
    this.name = 'AiError'
    this.recoverable = recoverable
  }
}

function makeClient(apiKey: string): Anthropic {
  // BYO-key client-side app: the key is the user's own, entered by them,
  // stored only in their localStorage. dangerouslyAllowBrowser acknowledges
  // exactly that tradeoff.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

function hexId(text: string): string {
  return (djb2(text) >>> 0).toString(16).toUpperCase()
}

function firstText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text') return block.text
  }
  return ''
}

/** Pick concrete subject/difficulty for the AI call (respects filters). */
function resolveAxes(filters: Filters): { subject: Subject; difficulty: Difficulty } {
  const subject = filters.subject ?? ALL_SUBJECTS[Math.floor(Math.random() * ALL_SUBJECTS.length)]
  const difficulty =
    filters.difficulty ?? DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)]
  return { subject, difficulty }
}

/**
 * Generate a fresh project prompt with Claude. A random template from the
 * filtered pool is passed as INSPIRATION ONLY — the model is asked to write
 * something new in the same spirit, which is what breaks the mad-libs
 * sameness ceiling.
 */
export async function aiGenerate(
  apiKey: string,
  model: AiModel,
  filters: Filters,
): Promise<GeneratedPrompt> {
  const { subject, difficulty } = resolveAxes(filters)
  const pool = getTemplates({ subject, difficulty })
  const inspiration = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)].text : ''
  const client = makeClient(apiKey)

  let text: string
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: [
        'You write single, self-contained, genuinely fun weekend-project prompts',
        'for builders. Each prompt is 2-4 sentences: what to build, one concrete',
        'mechanic that makes it interesting, and it MUST end with exactly one',
        'twist sentence starting with "Twist: ". Everything must be buildable',
        'client-side with no paid APIs. Never repeat the inspiration prompt;',
        'write something meaningfully different each time. Respond with ONLY the',
        'prompt text — no preamble, no quotes, no markdown.',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: [
            `Subject: ${SUBJECT_LABELS[subject]}. Difficulty: ${difficulty}`,
            `(scope it to ${DIFFICULTY_TO_TIME[difficulty]}).`,
            inspiration ? `Inspiration (do NOT copy, just match the vibe): "${inspiration}"` : '',
            `Random spark #${Math.floor(Math.random() * 1_000_000)} — surprise me.`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    })
    if (response.stop_reason === 'refusal') {
      throw new AiError('The model declined this request.', true)
    }
    if (response.stop_reason === 'max_tokens') {
      throw new AiError('The model ran out of room mid-prompt.', true)
    }
    text = firstText(response.content).trim()
  } catch (e) {
    throw toAiError(e)
  }
  if (text === '') throw new AiError('Empty response from the model.', true)
  if (!text.includes('Twist:')) {
    throw new AiError('Model output was missing its twist.', true)
  }

  const id = hexId(`ai:${text}`)
  return {
    id,
    text,
    subject,
    difficulty,
    timeBand: DIFFICULTY_TO_TIME[difficulty],
    seed: -1, // AI prompts are not seed-reproducible; -1 marks AI origin
    templateId: 'ai',
    serial: serialFromId(id),
    }
}

const SCOUT_SCHEMA = {
  type: 'object',
  properties: {
    rungs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rung: { type: 'string', enum: [...LADDER_RUNGS] },
          text: { type: 'string' },
        },
        required: ['rung', 'text'],
        additionalProperties: false,
      },
    },
    remixes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lens: { type: 'string' },
          subject: { type: 'string', enum: ALL_SUBJECTS },
          text: { type: 'string' },
        },
        required: ['lens', 'subject', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['rungs', 'remixes'],
  additionalProperties: false,
} as const

/**
 * Real Brain Scout: expand a seed idea into the 4-rung ladder + 3 remixes
 * with actual reasoning about THIS idea (the template engine can only wrap
 * canned sentences around the phrase). Returns the frozen ScoutResult shape;
 * domain invariants (4 rungs in order, 3 distinct lenses, verbatim phrase)
 * are enforced locally after the call.
 */
export async function aiScout(
  apiKey: string,
  model: AiModel,
  seedPhrase: string,
): Promise<ScoutResult> {
  const client = makeClient(apiKey)
  const lensMenu = ALL_SUBJECTS.map(
    (s) => `${SUBJECT_LABELS[s]} (${s}): ${getLenses(s).join(', ')}`,
  ).join('\n')

  let parsed: {
    rungs: { rung: string; text: string }[]
    remixes: { lens: string; subject: string; text: string }[]
  }
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: SCOUT_SCHEMA as unknown as Record<string, unknown> },
      },
      system: [
        'You are Brain Scout: you expand a builder\'s seed idea into bigger,',
        'concrete versions of ITSELF. Rungs: exactly 4, in order Weekend, Week,',
        'Month, Moonshot — each 2-3 sentences scoping the SAME idea to that',
        'tier (Weekend = tiny shippable slice; Week = solid v1; Month =',
        'polished with real users; Moonshot = the audacious platform version).',
        'Every rung text must contain the user\'s seed phrase VERBATIM,',
        'exactly as given. Remixes: exactly 3, each applying one lens from the',
        'menu (copy the lens name exactly, set subject to its internal key) to',
        'the seed phrase — again containing it verbatim. Be specific to the',
        'idea: name real features, data, and mechanics, not generic advice.',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: `Seed idea: "${seedPhrase}"\n\nLens menu:\n${lensMenu}`,
        },
      ],
    })
    if (response.stop_reason === 'refusal') {
      throw new AiError('The model declined this request.', true)
    }
    if (response.stop_reason === 'max_tokens') {
      throw new AiError('The model ran out of room mid-expansion.', true)
    }
    parsed = JSON.parse(firstText(response.content))
  } catch (e) {
    throw toAiError(e)
  }

  // Enforce the frozen domain invariants locally — never trust wire output.
  // Shape-check FIRST so schema-noncompliant JSON ('null', {"rungs": 5})
  // surfaces as AiError, not a raw TypeError escaping the module contract.
  if (!parsed || !Array.isArray(parsed.rungs) || !Array.isArray(parsed.remixes)) {
    throw new AiError('Model output had the wrong shape.', true)
  }
  const rungs = LADDER_RUNGS.map((rung) => {
    const found = parsed.rungs.find((r) => r.rung === rung)
    if (!found || typeof found.text !== 'string' || !found.text.includes(seedPhrase)) {
      throw new AiError(`Model output missing a valid "${rung}" rung.`, true)
    }
    return { rung, text: found.text, id: hexId(`scout:${seedPhrase}${rung}`) }
  })

  const seenLenses = new Set<string>()
  const remixes = parsed.remixes
    .filter((r) => {
      if (typeof r.text !== 'string' || !r.text.includes(seedPhrase)) return false
      if (!ALL_SUBJECTS.includes(r.subject as Subject)) return false
      if (seenLenses.has(r.lens)) return false
      seenLenses.add(r.lens)
      return true
    })
    .slice(0, 3)
    .map((r) => ({
      lens: r.lens,
      subject: r.subject as Subject,
      text: r.text,
      id: hexId(`scout:${seedPhrase}${r.lens}`),
    }))
  if (remixes.length !== 3) {
    throw new AiError('Model output did not include 3 valid remixes.', true)
  }

  return { seedPhrase, rungs, remixes }
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e
  if (e instanceof Anthropic.AuthenticationError) {
    return new AiError('Invalid API key — check Settings.', false)
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new AiError('Rate limited — try again in a moment.', true)
  }
  if (e instanceof Anthropic.APIError) {
    return new AiError(`API error: ${e.message}`, true)
  }
  if (e instanceof SyntaxError) {
    return new AiError('Model returned unparseable output.', true)
  }
  return new AiError('Network error — falling back to template mode.', true)
}
