/**
 * The interview: propose the next block, write a block's sentence, polish the
 * final draft. The model is injected as a ModelClient so every test here runs
 * without network.
 *
 * Nothing in this module mutates a Brief. Callers stage what comes back and
 * commit only on user acceptance, so a malformed response cannot corrupt state.
 */
import Anthropic from '@anthropic-ai/sdk'

import { AiError } from './ai'
import type { BlockKind, Brief, Proposal } from './brief'
import { renderDraft } from './render'
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

export function makeAnthropicClient(apiKey: string, model: AiModel): ModelClient {
  // BYO-key client-side app: the key is the user's own, stored only in their
  // localStorage. dangerouslyAllowBrowser acknowledges exactly that tradeoff.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  return {
    async complete(req) {
      const response = await client.messages.create({
        model,
        max_tokens: req.maxTokens,
        output_config: { effort: 'low' },
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      })
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

export async function proposeNext(client: ModelClient, brief: Brief): Promise<Proposal | null> {
  const raw = await client.complete({
    system: PROPOSE_SYSTEM,
    user: briefContext(brief),
    maxTokens: 1000,
    json: true,
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|\n?```$/g, ''))
  } catch {
    throw new AiError('Model returned unparseable output.', true)
  }
  // Shape-check before touching any field, so schema-noncompliant JSON
  // surfaces as AiError rather than a raw TypeError escaping the contract.
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
