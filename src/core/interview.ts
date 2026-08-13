/**
 * The interview: propose the next block, write a block's sentence, polish the
 * final draft. The model is injected as a ModelClient so every test here runs
 * without network.
 *
 * Nothing in this module mutates a Brief. Callers stage what comes back and
 * commit only on user acceptance, so a malformed response cannot corrupt state.
 */
import Anthropic from '@anthropic-ai/sdk'

import { AiError, toAiError } from './ai'
import type { BlockKind, Brief, Proposal } from './brief'
import { renderDraft } from './render'
import { djb2 } from './rng'
import type { AiModel } from '../state/settings'

const KINDS: BlockKind[] = ['intent', 'whoFor', 'hardPart', 'inputs', 'scope', 'wontDo', 'custom']

export interface ModelRequest {
  system: string
  user: string
  maxTokens: number
  json?: boolean
}

export interface ModelClient {
  complete(req: ModelRequest): Promise<string>
}

export function makeAnthropicClient(
  apiKey: string,
  model: AiModel,
  baseUrl = '',
): ModelClient {
  const gateway = baseUrl.trim()
  const viaGateway = gateway !== ''

  // BYO-key client-side app: the key is the user's own, stored only in their
  // localStorage. dangerouslyAllowBrowser acknowledges exactly that tradeoff.
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    ...(viaGateway
      ? {
          baseURL: gateway,
          // The Anthropic SDK authenticates with an x-api-key header; most
          // gateways expect a bearer token instead. Sending both costs
          // nothing and means either convention is satisfied.
          defaultHeaders: { Authorization: `Bearer ${apiKey}` },
        }
      : {}),
  })
  return {
    async complete(req) {
      let response
      try {
        response = await client.messages.create({
          model,
          max_tokens: req.maxTokens,
          // output_config is Anthropic-specific. Gateways reject unknown
          // top-level fields, so it only goes out on the direct path.
          ...(viaGateway ? {} : { output_config: { effort: 'low' as const } }),
          system: req.system,
          messages: [{ role: 'user', content: req.user }],
        })
      } catch (e) {
        // Without this the raw SDK error escapes, fails the `instanceof
        // AiError` check in App, and every real failure — bad key, 404,
        // CORS — is reported to the user as "Unexpected error."
        throw toAiError(e)
      }
      if (response.stop_reason === 'refusal') {
        throw new AiError('The model declined this request.', true)
      }
      if (response.stop_reason === 'max_tokens') {
        throw new AiError('The model ran out of room.', true)
      }
      for (const block of response.content) {
        if (block.type === 'text') return block.text
      }
      return ''
    },
  }
}

function briefContext(brief: Brief): string {
  const placed = brief.blocks.map((b) => `- ${b.kind} (${b.label}): ${b.answer}`).join('\n')
  return [
    `Seed idea: "${brief.seedIdea}"`,
    placed === '' ? 'No blocks placed yet.' : `Blocks already placed:\n${placed}`,
    `Draft so far: ${renderDraft(brief)}`,
  ].join('\n\n')
}

function stripFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\n?|\n?```$/g, '')
}

const PROPOSE_SYSTEM = [
  'You run a short interview that turns a rough idea into one sharp, specific prompt.',
  'Return ONE next question as JSON: {"done":false,"kind":...,"label":...,"question":...,"options":[...]}.',
  `kind must be one of: ${KINDS.join(', ')}.`,
  'label is 1-2 words, title case. question is one sentence, plain and concrete.',
  'options: 2-4 short concrete answers, the recommended one FIRST. Never include "Other".',
  'Never re-ask a kind already placed. Ask about what is genuinely still unknown.',
  'When the draft is specific enough to build from, return {"done":true} and nothing else.',
  'Respond with ONLY the JSON object — no markdown fence, no preamble.',
].join(' ')

/**
 * Shared proposal parser. Shape-checks before touching any field, so
 * schema-noncompliant JSON surfaces as AiError rather than a raw TypeError
 * escaping the module contract. Returns null only for {done:true}.
 */
function parseProposal(raw: string): Proposal | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(raw))
  } catch {
    throw new AiError('Model returned unparseable output.', true)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new AiError('Model output had the wrong shape.', true)
  }
  const p = parsed as Record<string, unknown>
  if (p.done === true) return null

  if (
    typeof p.kind !== 'string' ||
    !KINDS.includes(p.kind as BlockKind) ||
    typeof p.label !== 'string' ||
    typeof p.question !== 'string' ||
    !Array.isArray(p.options)
  ) {
    throw new AiError('Model output had the wrong shape.', true)
  }
  const options = p.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '')
  if (options.length < 2) {
    throw new AiError('Model proposed too few options.', true)
  }
  return {
    kind: p.kind as BlockKind,
    label: p.label,
    question: p.question,
    options: options.slice(0, 4),
  }
}

export async function proposeNext(client: ModelClient, brief: Brief): Promise<Proposal | null> {
  const raw = await client.complete({
    system: PROPOSE_SYSTEM,
    user: briefContext(brief),
    maxTokens: 1000,
    json: true,
  })
  return parseProposal(raw)
}

const SENTENCE_SYSTEM = [
  "You write ONE sentence for a build prompt, in the requester's voice.",
  'It states the given fact plainly and concretely, reads as natural prose, and',
  'joins smoothly onto the draft it follows. No preamble, no quotes, no markdown.',
  'Respond with ONLY the sentence.',
].join(' ')

export async function writeSentence(
  client: ModelClient,
  brief: Brief,
  kind: BlockKind,
  label: string,
  answer: string,
): Promise<string> {
  const raw = await client.complete({
    system: SENTENCE_SYSTEM,
    user: `${briefContext(brief)}\n\nNew fact — ${label} (${kind}): ${answer}\n\nWrite the sentence.`,
    maxTokens: 300,
  })
  const text = raw.trim().replace(/^"|"$/g, '').trim()
  if (text === '') throw new AiError('Model returned an empty sentence.', true)
  return text
}

const POLISH_SYSTEM = [
  'You smooth a build prompt into flowing prose. Keep every fact and every',
  'constraint exactly as given — add nothing, drop nothing, invent nothing.',
  'Improve only flow and connective tissue. Respond with ONLY the prose.',
].join(' ')

export async function polish(client: ModelClient, draft: string): Promise<string> {
  const raw = await client.complete({
    system: POLISH_SYSTEM,
    user: draft,
    maxTokens: 2000,
  })
  const text = raw.trim()
  return text === '' ? draft : text
}

export interface Guess {
  id: string
  topic: string
  assumption: string
}

const SKETCH_SYSTEM = [
  'You predict what a coding agent handed this prompt would actually build.',
  'Respond with ONLY JSON: {"outcome":"...","guesses":[{"topic":"...","assumption":"..."}]}.',
  'outcome: 3-6 sentences, concrete — name the screens/surfaces, the core behaviors,',
  'and end with what it will NOT include. No hedging, no "probably".',
  'guesses: 0-5 assumptions you had to INVENT because the prompt does not specify them,',
  'ONLY ones that would change what gets built — skip cosmetics. topic is 1-3 words;',
  'assumption is the concrete choice you made.',
].join(' ')

/**
 * The outcome sketch: what you'd get if you handed this prompt to a coding
 * agent, plus every assumption the model had to invent to say so. Those
 * inventions are the brief's ambiguities — the UI turns them into chips.
 * Chips are a bonus: a malformed guesses array degrades to [] rather than
 * failing a still-useful sketch.
 */
export async function sketchOutcome(
  client: ModelClient,
  brief: Brief,
): Promise<{ outcome: string; guesses: Guess[] }> {
  const raw = await client.complete({
    system: SKETCH_SYSTEM,
    user: briefContext(brief),
    maxTokens: 1500,
    json: true,
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(raw))
  } catch {
    throw new AiError('Model returned unparseable output.', true)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new AiError('Model output had the wrong shape.', true)
  }
  const p = parsed as Record<string, unknown>
  if (typeof p.outcome !== 'string' || p.outcome.trim() === '') {
    throw new AiError('Model output had the wrong shape.', true)
  }
  const guesses: Guess[] = (Array.isArray(p.guesses) ? p.guesses : [])
    .filter(
      (g): g is { topic: string; assumption: string } =>
        !!g &&
        typeof g === 'object' &&
        typeof (g as Record<string, unknown>).topic === 'string' &&
        typeof (g as Record<string, unknown>).assumption === 'string' &&
        (g as Record<string, unknown>).topic !== '' &&
        (g as Record<string, unknown>).assumption !== '',
    )
    .slice(0, 5)
    .map((g) => ({
      id: (djb2(`guess:${g.topic}:${g.assumption}`) >>> 0).toString(16).toUpperCase(),
      topic: g.topic,
      assumption: g.assumption,
    }))
  return { outcome: p.outcome.trim(), guesses }
}

const CHIP_SYSTEM = [
  'A prompt-preview had to assume something the prompt does not specify.',
  'Write ONE interview question that pins it down.',
  'Respond with ONLY JSON {"kind":...,"label":...,"question":...,"options":[...]} —',
  `kind one of: ${KINDS.join(', ')}; label 1-2 words; question one plain sentence;`,
  'options 2-4 short concrete answers. The FIRST option must be the assumption',
  'exactly as given (confirming the default), alternatives after it.',
].join(' ')

/**
 * Turns a sketch guess into a normal interview proposal. The assumption is
 * forced to first position regardless of what the model returns, so accepting
 * the recommended default always means confirming the guess.
 */
export async function chipToProposal(
  client: ModelClient,
  brief: Brief,
  guess: Guess,
): Promise<Proposal> {
  const raw = await client.complete({
    system: CHIP_SYSTEM,
    user: `${briefContext(brief)}\n\nTopic: ${guess.topic}\nAssumption made: ${guess.assumption}`,
    maxTokens: 800,
    json: true,
  })
  const proposal = parseProposal(raw)
  if (proposal === null) {
    throw new AiError('Model output had the wrong shape.', true)
  }
  const rest = proposal.options.filter((o) => o !== guess.assumption)
  return { ...proposal, options: [guess.assumption, ...rest].slice(0, 4) }
}
