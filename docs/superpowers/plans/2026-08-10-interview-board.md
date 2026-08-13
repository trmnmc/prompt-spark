# Interview Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Prompt Spark's one-shot generator with an interview that builds one sharp prompt as a board of editable lego blocks.

**Architecture:** Pure core, thin UI — the existing convention. `brief.ts` is a pure reducer over `Brief`/`Block`; `render.ts` turns a `Brief` into prose deterministically; `interview.ts` talks to Claude through an **injected `ModelClient`** so every core test runs without network. The UI is a board that stages proposals and only mutates the `Brief` on user acceptance.

**Tech Stack:** React 19, TypeScript 7, Vite 8, vitest 4 + jsdom, `@anthropic-ai/sdk` 0.116 (browser, BYO key).

## Global Constraints

- Every sentence is **LLM-written at placement and then frozen**. Nothing already on screen rewords itself. Template sentences are the degraded no-key path only.
- Core modules are **pure**: no `Date.now()`, no `Math.random()` inside `brief.ts` / `render.ts`. Callers pass `now`. Randomness stays at the UI boundary (existing `randomSeed()` pattern in `App.tsx`).
- **Proposals are staged; only user acceptance mutates the `Brief`.** A malformed or failed model response can never corrupt state.
- Ids use `djb2` from `src/core/rng.ts`, uppercase hex — the existing id convention.
- Any `useSyncExternalStore` store MUST return a cached snapshot reference (see KI-1 in `REPORT.md`; `src/state/favorites.ts:29` is the reference implementation).
- Reuse `AiError` from `src/core/ai.ts:34` and its `recoverable` flag. Do not invent a second error type.
- Tests: `npx vitest run`. Build: `npm run build`. Both must be green at every commit.

---

### Task 1: `Brief`/`Block` model and pure reducer

**Files:**
- Create: `src/core/brief.ts`
- Test: `src/core/brief.test.ts`

**Interfaces:**
- Consumes: `djb2` from `src/core/rng.ts`
- Produces: `BlockKind`, `Block`, `Brief`, `Proposal`, `createBrief(seedIdea, now)`, `addBlock(brief, draft, now)`, `editBlock(brief, id, patch, now)`, `removeBlock(brief, id, now)`, `moveBlock(brief, id, toIndex, now)`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/brief.test.ts
import { describe, expect, it } from 'vitest'
import { addBlock, createBrief, editBlock, moveBlock, removeBlock } from './brief'

const T0 = 1_700_000_000_000
const draft = (answer: string) => ({
  kind: 'intent' as const,
  label: 'Intent',
  question: 'What are you building?',
  answer,
  sentence: `Build ${answer}.`,
})

describe('brief reducer', () => {
  it('creates an empty brief carrying the seed idea', () => {
    const b = createBrief('a fridge leftovers app', T0)
    expect(b.seedIdea).toBe('a fridge leftovers app')
    expect(b.blocks).toEqual([])
    expect(b.createdAt).toBe(T0)
    expect(b.updatedAt).toBe(T0)
  })

  it('appends blocks in order and stamps updatedAt', () => {
    const b = addBlock(createBrief('x', T0), draft('a thing'), T0 + 1)
    expect(b.blocks).toHaveLength(1)
    expect(b.blocks[0].answer).toBe('a thing')
    expect(b.blocks[0].id).toMatch(/^[0-9A-F]+$/)
    expect(b.updatedAt).toBe(T0 + 1)
  })

  it('never mutates the input brief', () => {
    const before = createBrief('x', T0)
    addBlock(before, draft('a thing'), T0 + 1)
    expect(before.blocks).toEqual([])
  })

  it('edits answer and sentence in place, leaving id and order alone', () => {
    const one = addBlock(createBrief('x', T0), draft('a thing'), T0 + 1)
    const id = one.blocks[0].id
    const two = editBlock(one, id, { answer: 'other', sentence: 'Build other.' }, T0 + 2)
    expect(two.blocks[0].id).toBe(id)
    expect(two.blocks[0].answer).toBe('other')
    expect(two.blocks[0].sentence).toBe('Build other.')
  })

  it('removes exactly the named block', () => {
    let b = addBlock(createBrief('x', T0), draft('one'), T0 + 1)
    b = addBlock(b, draft('two'), T0 + 2)
    const gone = removeBlock(b, b.blocks[0].id, T0 + 3)
    expect(gone.blocks.map((x) => x.answer)).toEqual(['two'])
  })

  it('moves a block to a new index', () => {
    let b = addBlock(createBrief('x', T0), draft('one'), T0 + 1)
    b = addBlock(b, draft('two'), T0 + 2)
    b = addBlock(b, draft('three'), T0 + 3)
    const moved = moveBlock(b, b.blocks[2].id, 0, T0 + 4)
    expect(moved.blocks.map((x) => x.answer)).toEqual(['three', 'one', 'two'])
  })

  it('clamps out-of-range move targets instead of dropping the block', () => {
    let b = addBlock(createBrief('x', T0), draft('one'), T0 + 1)
    b = addBlock(b, draft('two'), T0 + 2)
    expect(moveBlock(b, b.blocks[0].id, 99, T0 + 3).blocks.map((x) => x.answer)).toEqual(['two', 'one'])
    expect(moveBlock(b, b.blocks[0].id, -5, T0 + 3).blocks.map((x) => x.answer)).toEqual(['one', 'two'])
  })

  it('returns the same brief for unknown ids', () => {
    const b = addBlock(createBrief('x', T0), draft('one'), T0 + 1)
    expect(removeBlock(b, 'NOPE', T0 + 2)).toBe(b)
    expect(editBlock(b, 'NOPE', { answer: 'z', sentence: 'z' }, T0 + 2)).toBe(b)
    expect(moveBlock(b, 'NOPE', 0, T0 + 2)).toBe(b)
  })

  it('gives distinct ids to blocks with identical content', () => {
    let b = addBlock(createBrief('x', T0), draft('same'), T0 + 1)
    b = addBlock(b, draft('same'), T0 + 2)
    expect(b.blocks[0].id).not.toBe(b.blocks[1].id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/brief.test.ts`
Expected: FAIL — `Failed to resolve import "./brief"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/brief.ts
/**
 * Brief — the single source of truth for an interview in progress.
 *
 * A Brief is an ordered list of Blocks. Every Block carries a `sentence`
 * written once at placement and then FROZEN: rendering is pure concatenation,
 * so nothing already on screen can reword itself while the user reads it.
 *
 * Pure by contract — no Date.now, no Math.random. Callers pass `now`.
 * Ids are djb2 over content + position, so two blocks with identical text
 * still get distinct ids.
 */
import { djb2 } from './rng'

export type BlockKind =
  | 'intent'
  | 'whoFor'
  | 'hardPart'
  | 'inputs'
  | 'scope'
  | 'wontDo'
  | 'custom'

export interface Block {
  id: string
  kind: BlockKind
  label: string
  /** null iff the user added this block themselves. */
  question: string | null
  answer: string
  /** Written once at placement, then frozen. */
  sentence: string
}

export interface Brief {
  id: string
  seedIdea: string
  blocks: Block[]
  createdAt: number
  updatedAt: number
}

/** A staged next block. Never written to a Brief until the user accepts. */
export interface Proposal {
  kind: BlockKind
  label: string
  question: string
  /** 2-4 options, recommended first. */
  options: string[]
}

export type BlockDraft = Omit<Block, 'id'>

function hex(s: string): string {
  return djb2(s).toString(16).toUpperCase()
}

export function createBrief(seedIdea: string, now: number): Brief {
  return {
    id: hex(`brief:${seedIdea}:${now}`),
    seedIdea,
    blocks: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function addBlock(brief: Brief, draft: BlockDraft, now: number): Brief {
  const id = hex(`block:${brief.id}:${brief.blocks.length}:${draft.kind}:${draft.answer}`)
  return {
    ...brief,
    blocks: [...brief.blocks, { ...draft, id }],
    updatedAt: now,
  }
}

export function editBlock(
  brief: Brief,
  id: string,
  patch: Pick<Block, 'answer' | 'sentence'>,
  now: number,
): Brief {
  const index = brief.blocks.findIndex((b) => b.id === id)
  if (index === -1) return brief
  const blocks = [...brief.blocks]
  blocks[index] = { ...blocks[index], ...patch }
  return { ...brief, blocks, updatedAt: now }
}

export function removeBlock(brief: Brief, id: string, now: number): Brief {
  const index = brief.blocks.findIndex((b) => b.id === id)
  if (index === -1) return brief
  return {
    ...brief,
    blocks: [...brief.blocks.slice(0, index), ...brief.blocks.slice(index + 1)],
    updatedAt: now,
  }
}

export function moveBlock(brief: Brief, id: string, toIndex: number, now: number): Brief {
  const from = brief.blocks.findIndex((b) => b.id === id)
  if (from === -1) return brief
  const target = Math.max(0, Math.min(toIndex, brief.blocks.length - 1))
  if (target === from) return brief
  const blocks = [...brief.blocks]
  const [moved] = blocks.splice(from, 1)
  blocks.splice(target, 0, moved)
  return { ...brief, blocks, updatedAt: now }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/brief.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/brief.ts src/core/brief.test.ts
git commit -m "feat(core): Brief/Block model and pure reducer"
```

---

### Task 2: Deterministic draft rendering

**Files:**
- Create: `src/core/render.ts`
- Test: `src/core/render.test.ts`

**Interfaces:**
- Consumes: `Brief`, `Block`, `BlockKind` from `src/core/brief.ts`
- Produces: `renderDraft(brief): string`, `templateSentence(kind, label, answer): string`

`templateSentence` is the **no-key degraded path only** — with a key present, `interview.ts` writes every sentence.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/render.test.ts
import { describe, expect, it } from 'vitest'
import { addBlock, createBrief } from './brief'
import { renderDraft, templateSentence } from './render'

const T0 = 1_700_000_000_000
const block = (kind: 'intent' | 'wontDo', sentence: string) => ({
  kind,
  label: kind,
  question: 'q',
  answer: 'a',
  sentence,
})

describe('renderDraft', () => {
  it('returns the seed idea alone when no blocks are placed', () => {
    expect(renderDraft(createBrief('a fridge app', T0))).toBe('a fridge app')
  })

  it('joins frozen sentences into one paragraph', () => {
    let b = addBlock(createBrief('x', T0), block('intent', 'Build a fridge tool.'), T0)
    b = addBlock(b, block('wontDo', 'Leave out shopping lists.'), T0)
    expect(renderDraft(b)).toBe('Build a fridge tool. Leave out shopping lists.')
  })

  it('is a pure function of block order', () => {
    let b = addBlock(createBrief('x', T0), block('intent', 'One.'), T0)
    b = addBlock(b, block('wontDo', 'Two.'), T0)
    const forward = renderDraft(b)
    const reversed = renderDraft({ ...b, blocks: [...b.blocks].reverse() })
    expect(forward).toBe('One. Two.')
    expect(reversed).toBe('Two. One.')
  })

  it('removing a block removes exactly its sentence', () => {
    let b = addBlock(createBrief('x', T0), block('intent', 'Keep.'), T0)
    b = addBlock(b, block('wontDo', 'Drop.'), T0)
    const without = { ...b, blocks: b.blocks.filter((x) => x.sentence !== 'Drop.') }
    expect(renderDraft(without)).toBe('Keep.')
  })

  it('trims stray whitespace between sentences', () => {
    let b = addBlock(createBrief('x', T0), block('intent', '  One.  '), T0)
    b = addBlock(b, block('wontDo', ' Two. '), T0)
    expect(renderDraft(b)).toBe('One. Two.')
  })

  it('skips blocks whose sentence is empty', () => {
    let b = addBlock(createBrief('x', T0), block('intent', 'One.'), T0)
    b = addBlock(b, block('wontDo', '   '), T0)
    expect(renderDraft(b)).toBe('One.')
  })
})

describe('templateSentence', () => {
  it('produces a readable sentence per kind', () => {
    expect(templateSentence('whoFor', 'Who for', 'just me')).toBe("It's for just me.")
    expect(templateSentence('wontDo', "Won't do", 'shopping lists')).toBe(
      'Deliberately leave out shopping lists.',
    )
  })

  it('falls back to label-prefixed prose for custom blocks', () => {
    expect(templateSentence('custom', 'Budget', 'under $10/mo')).toBe('Budget: under $10/mo.')
  })

  it('does not double a terminal period', () => {
    expect(templateSentence('whoFor', 'Who for', 'just me.')).toBe("It's for just me.")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/render.test.ts`
Expected: FAIL — `Failed to resolve import "./render"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/render.ts
/**
 * Brief -> draft prose. Pure and deterministic: the draft is a concatenation
 * of frozen per-block sentences, which is what makes the draft grow stably
 * on screen instead of rewording itself under the reader.
 */
import type { Brief, BlockKind } from './brief'

const TEMPLATES: Partial<Record<BlockKind, (answer: string) => string>> = {
  intent: (a) => `Build ${a}`,
  whoFor: (a) => `It's for ${a}`,
  hardPart: (a) => `The hard part is ${a}`,
  inputs: (a) => `It works from ${a}`,
  scope: (a) => `Scope it to ${a}`,
  wontDo: (a) => `Deliberately leave out ${a}`,
}

/** Degraded no-key path only. With a key, interview.ts writes the sentence. */
export function templateSentence(kind: BlockKind, label: string, answer: string): string {
  const trimmed = answer.trim().replace(/\.$/, '')
  const make = TEMPLATES[kind]
  return make ? `${make(trimmed)}.` : `${label}: ${trimmed}.`
}

export function renderDraft(brief: Brief): string {
  const sentences = brief.blocks
    .map((b) => b.sentence.trim())
    .filter((s) => s !== '')
  if (sentences.length === 0) return brief.seedIdea
  return sentences.join(' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/render.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/render.ts src/core/render.test.ts
git commit -m "feat(core): deterministic Brief -> draft prose rendering"
```

---

### Task 3: Interview client with injected model

**Files:**
- Create: `src/core/interview.ts`
- Test: `src/core/interview.test.ts`

**Interfaces:**
- Consumes: `Brief`, `Proposal`, `BlockKind` from `src/core/brief.ts`; `renderDraft` from `src/core/render.ts`; `AiError` from `src/core/ai.ts`; `AiModel` from `src/state/settings.ts`
- Produces: `ModelClient` interface, `makeAnthropicClient(apiKey, model): ModelClient`, `proposeNext(client, brief): Promise<Proposal | null>`, `writeSentence(client, brief, kind, label, answer): Promise<string>`, `polish(client, draft): Promise<string>`

`proposeNext` returns `null` when the model signals `done`. `done` is advisory — the UI lets the user continue past it or stop before it.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/interview.test.ts
import { describe, expect, it } from 'vitest'
import { AiError } from './ai'
import { addBlock, createBrief } from './brief'
import type { ModelClient } from './interview'
import { polish, proposeNext, writeSentence } from './interview'

const T0 = 1_700_000_000_000
const stub = (reply: string): ModelClient => ({ complete: async () => reply })
const throwing = (e: unknown): ModelClient => ({
  complete: async () => {
    throw e
  },
})

const GOOD = JSON.stringify({
  done: false,
  kind: 'whoFor',
  label: 'Who for',
  question: 'Who is this for?',
  options: ['Just me', 'A small team', 'Anyone'],
})

describe('proposeNext', () => {
  it('parses a well-formed proposal', async () => {
    const p = await proposeNext(stub(GOOD), createBrief('x', T0))
    expect(p).toEqual({
      kind: 'whoFor',
      label: 'Who for',
      question: 'Who is this for?',
      options: ['Just me', 'A small team', 'Anyone'],
    })
  })

  it('returns null when the model says done', async () => {
    expect(await proposeNext(stub(JSON.stringify({ done: true })), createBrief('x', T0))).toBeNull()
  })

  it('rejects a non-object payload as AiError', async () => {
    await expect(proposeNext(stub('null'), createBrief('x', T0))).rejects.toBeInstanceOf(AiError)
  })

  it('rejects an unknown block kind', async () => {
    const bad = JSON.stringify({ done: false, kind: 'nonsense', label: 'X', question: 'Q', options: ['a', 'b'] })
    await expect(proposeNext(stub(bad), createBrief('x', T0))).rejects.toBeInstanceOf(AiError)
  })

  it('rejects fewer than two options', async () => {
    const bad = JSON.stringify({ done: false, kind: 'whoFor', label: 'X', question: 'Q', options: ['only'] })
    await expect(proposeNext(stub(bad), createBrief('x', T0))).rejects.toBeInstanceOf(AiError)
  })

  it('caps options at four', async () => {
    const many = JSON.stringify({
      done: false, kind: 'whoFor', label: 'X', question: 'Q',
      options: ['a', 'b', 'c', 'd', 'e', 'f'],
    })
    const p = await proposeNext(stub(many), createBrief('x', T0))
    expect(p?.options).toEqual(['a', 'b', 'c', 'd'])
  })

  it('rejects unparseable JSON as AiError', async () => {
    await expect(proposeNext(stub('not json'), createBrief('x', T0))).rejects.toBeInstanceOf(AiError)
  })

  it('passes AiError through untouched', async () => {
    const err = new AiError('rate limited', true)
    await expect(proposeNext(throwing(err), createBrief('x', T0))).rejects.toBe(err)
  })

  it('does not repeat a kind already placed', async () => {
    let brief = createBrief('x', T0)
    brief = addBlock(brief, {
      kind: 'whoFor', label: 'Who for', question: 'q', answer: 'me', sentence: 'For me.',
    }, T0)
    let seenUser = ''
    const spy: ModelClient = {
      complete: async (req) => {
        seenUser = req.user
        return GOOD
      },
    }
    await proposeNext(spy, brief)
    expect(seenUser).toContain('whoFor')
  })
})

describe('writeSentence', () => {
  it('trims and returns the model sentence', async () => {
    const s = await writeSentence(stub('  Build a fridge tool.  '), createBrief('x', T0), 'intent', 'Intent', 'a fridge tool')
    expect(s).toBe('Build a fridge tool.')
  })

  it('rejects an empty sentence as AiError', async () => {
    await expect(
      writeSentence(stub('   '), createBrief('x', T0), 'intent', 'Intent', 'a thing'),
    ).rejects.toBeInstanceOf(AiError)
  })

  it('strips surrounding quotes the model sometimes adds', async () => {
    const s = await writeSentence(stub('"Build a thing."'), createBrief('x', T0), 'intent', 'Intent', 'a thing')
    expect(s).toBe('Build a thing.')
  })
})

describe('polish', () => {
  it('returns the smoothed draft', async () => {
    expect(await polish(stub('Smoothed prose.'), 'rough prose')).toBe('Smoothed prose.')
  })

  it('falls back to the raw draft when the model returns nothing', async () => {
    expect(await polish(stub('  '), 'rough prose')).toBe('rough prose')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/interview.test.ts`
Expected: FAIL — `Failed to resolve import "./interview"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/interview.ts
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
  const placed = brief.blocks
    .map((b) => `- ${b.kind} (${b.label}): ${b.answer}`)
    .join('\n')
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
  'You write ONE sentence for a build prompt, in the requester\'s voice.',
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/interview.test.ts`
Expected: PASS, 14 tests

- [ ] **Step 5: Commit**

```bash
git add src/core/interview.ts src/core/interview.test.ts
git commit -m "feat(core): interview client with injected model and shape-checked parsing"
```

---

### Task 4: Brief persistence store

**Files:**
- Create: `src/state/briefStore.ts`
- Test: `src/state/briefStore.test.ts`

**Interfaces:**
- Consumes: `Brief` from `src/core/brief.ts`
- Produces: `BRIEF_KEY`, `loadBrief()`, `saveBrief(brief)`, `clearBrief()`, `subscribe(fn)`, `useBrief()`

Mirrors `src/state/favorites.ts` exactly, including the cached-snapshot discipline that KI-1 was about.

- [ ] **Step 1: Write the failing test**

```ts
// src/state/briefStore.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createBrief } from '../core/brief'
import { BRIEF_KEY, clearBrief, loadBrief, saveBrief, subscribe } from './briefStore'

const T0 = 1_700_000_000_000

describe('briefStore', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when nothing is stored', () => {
    expect(loadBrief()).toBeNull()
  })

  it('round-trips a brief', () => {
    const b = createBrief('a fridge app', T0)
    saveBrief(b)
    expect(loadBrief()).toEqual(b)
  })

  it('returns null for invalid JSON', () => {
    localStorage.setItem(BRIEF_KEY, '{not json')
    expect(loadBrief()).toBeNull()
  })

  it('returns null for a payload missing the blocks array', () => {
    localStorage.setItem(BRIEF_KEY, JSON.stringify({ id: 'x', seedIdea: 'y' }))
    expect(loadBrief()).toBeNull()
  })

  it('clears the stored brief', () => {
    saveBrief(createBrief('x', T0))
    clearBrief()
    expect(loadBrief()).toBeNull()
  })

  it('notifies subscribers on save and clear', () => {
    let calls = 0
    const unsub = subscribe(() => calls++)
    saveBrief(createBrief('x', T0))
    clearBrief()
    unsub()
    saveBrief(createBrief('y', T0))
    expect(calls).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/briefStore.test.ts`
Expected: FAIL — `Failed to resolve import "./briefStore"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/state/briefStore.ts
/**
 * Brief persistence — one in-progress interview, in localStorage.
 *
 * Follows src/state/favorites.ts: getSnapshot returns a CACHED reference that
 * changes only on a real write. Returning a fresh object each call makes React
 * conclude the store is perpetually changing and loop (see KI-1 in REPORT.md).
 */
import { useSyncExternalStore } from 'react'

import type { Brief } from '../core/brief'

export const BRIEF_KEY = 'prompt-spark:brief:v1'

const listeners = new Set<() => void>()
let cachedSnapshot: Brief | null = null
let cacheValid = false

function notify(): void {
  cacheValid = false
  for (const fn of listeners) fn()
}

function isBrief(raw: unknown): raw is Brief {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.seedIdea === 'string' &&
    Array.isArray(r.blocks) &&
    typeof r.createdAt === 'number' &&
    typeof r.updatedAt === 'number'
  )
}

export function loadBrief(): Brief | null {
  try {
    const raw = localStorage.getItem(BRIEF_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isBrief(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveBrief(brief: Brief): void {
  localStorage.setItem(BRIEF_KEY, JSON.stringify(brief))
  notify()
}

export function clearBrief(): void {
  localStorage.removeItem(BRIEF_KEY)
  notify()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function getSnapshot(): Brief | null {
  if (!cacheValid) {
    cachedSnapshot = loadBrief()
    cacheValid = true
  }
  return cachedSnapshot
}

export function useBrief(): Brief | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/briefStore.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/state/briefStore.ts src/state/briefStore.test.ts
git commit -m "feat(state): Brief persistence with cached-snapshot store"
```

---

### Task 5: Board UI — blocks, proposal, draft

**Files:**
- Create: `src/ui/BlockRow.tsx`
- Create: `src/ui/ProposalCard.tsx`
- Create: `src/ui/BoardView.tsx`
- Modify: `src/styles/app.css` (append board styles)
- Test: `src/ui/BoardView.test.tsx`

**Interfaces:**
- Consumes: `Brief`, `Block`, `Proposal` from `src/core/brief.ts`; `renderDraft` from `src/core/render.ts`
- Produces: `BoardView` props `{ brief, draft, proposal, loading, note, onAccept(option), onAddOwn(label, answer), onEdit(id, answer), onRemove(id), onMove(id, toIndex), onFinish() }`

`BoardView` is presentational — it owns no async state. All model calls live in `App.tsx` (Task 6), matching how scout state was lifted out of `BrainScoutView` after the cycle-9 review.

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/BoardView.test.tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { addBlock, createBrief } from '../core/brief'
import { renderDraft } from '../core/render'
import BoardView from './BoardView'

const T0 = 1_700_000_000_000

function briefWithTwo() {
  let b = createBrief('a fridge app', T0)
  b = addBlock(b, { kind: 'intent', label: 'Intent', question: 'q', answer: 'a fridge tool', sentence: 'Build a fridge tool.' }, T0)
  b = addBlock(b, { kind: 'whoFor', label: 'Who For', question: 'q', answer: 'just me', sentence: "It's for just me." }, T0)
  return b
}

const noop = () => {}
const baseProps = {
  proposal: null, loading: false, note: null,
  onAccept: noop, onAddOwn: noop, onEdit: noop, onRemove: noop, onMove: noop, onFinish: noop,
}

describe('BoardView', () => {
  it('renders one row per placed block', () => {
    const brief = briefWithTwo()
    render(<BoardView {...baseProps} brief={brief} draft={renderDraft(brief)} />)
    expect(screen.getAllByTestId('block-row')).toHaveLength(2)
  })

  it('shows the growing draft', () => {
    const brief = briefWithTwo()
    render(<BoardView {...baseProps} brief={brief} draft={renderDraft(brief)} />)
    expect(screen.getByTestId('draft')).toHaveTextContent("Build a fridge tool. It's for just me.")
  })

  it('renders the staged proposal with its options', () => {
    const brief = briefWithTwo()
    render(
      <BoardView {...baseProps} brief={brief} draft={renderDraft(brief)}
        proposal={{ kind: 'inputs', label: 'Inputs', question: 'What does it know?', options: ['I tell it', 'A list'] }} />,
    )
    expect(screen.getByText('What does it know?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I tell it' })).toBeTruthy()
  })

  it('calls onAccept with the chosen option', () => {
    const onAccept = vi.fn()
    const brief = briefWithTwo()
    render(
      <BoardView {...baseProps} onAccept={onAccept} brief={brief} draft={renderDraft(brief)}
        proposal={{ kind: 'inputs', label: 'Inputs', question: 'Q?', options: ['first', 'second'] }} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'second' }))
    expect(onAccept).toHaveBeenCalledWith('second')
  })

  it('calls onRemove with the block id', () => {
    const onRemove = vi.fn()
    const brief = briefWithTwo()
    render(<BoardView {...baseProps} onRemove={onRemove} brief={brief} draft={renderDraft(brief)} />)
    const rows = screen.getAllByTestId('block-row')
    fireEvent.click(within(rows[0]).getByRole('button', { name: /remove/i }))
    expect(onRemove).toHaveBeenCalledWith(brief.blocks[0].id)
  })

  it('edits a block answer in place', () => {
    const onEdit = vi.fn()
    const brief = briefWithTwo()
    render(<BoardView {...baseProps} onEdit={onEdit} brief={brief} draft={renderDraft(brief)} />)
    const rows = screen.getAllByTestId('block-row')
    fireEvent.click(within(rows[0]).getByRole('button', { name: /edit/i }))
    const input = within(rows[0]).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'a better tool' } })
    fireEvent.click(within(rows[0]).getByRole('button', { name: /save/i }))
    expect(onEdit).toHaveBeenCalledWith(brief.blocks[0].id, 'a better tool')
  })

  it('adds a user block with its own label', () => {
    const onAddOwn = vi.fn()
    const brief = briefWithTwo()
    render(<BoardView {...baseProps} onAddOwn={onAddOwn} brief={brief} draft={renderDraft(brief)} />)
    fireEvent.click(screen.getByRole('button', { name: /add a block/i }))
    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: 'Budget' } })
    fireEvent.change(screen.getByLabelText(/detail/i), { target: { value: 'under $10 a month' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onAddOwn).toHaveBeenCalledWith('Budget', 'under $10 a month')
  })

  it('surfaces a note without hiding the board', () => {
    const brief = briefWithTwo()
    render(<BoardView {...baseProps} note="Rate limited." brief={brief} draft={renderDraft(brief)} />)
    expect(screen.getByText('Rate limited.')).toBeTruthy()
    expect(screen.getAllByTestId('block-row')).toHaveLength(2)
  })

  it('disables the option buttons while loading', () => {
    const brief = briefWithTwo()
    render(
      <BoardView {...baseProps} loading brief={brief} draft={renderDraft(brief)}
        proposal={{ kind: 'inputs', label: 'Inputs', question: 'Q?', options: ['a', 'b'] }} />,
    )
    expect(screen.getByRole('button', { name: 'a' })).toHaveProperty('disabled', true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/BoardView.test.tsx`
Expected: FAIL — `Failed to resolve import "./BoardView"`

If `@testing-library/react` is absent, add it first:

```bash
npm install --save-dev @testing-library/react @testing-library/dom
```

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/ui/BlockRow.tsx
import { useState } from 'react'

import type { Block } from '../core/brief'

interface Props {
  block: Block
  index: number
  total: number
  onEdit: (id: string, answer: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, toIndex: number) => void
}

export default function BlockRow({ block, index, total, onEdit, onRemove, onMove }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(block.answer)

  function save() {
    const next = value.trim()
    if (next !== '' && next !== block.answer) onEdit(block.id, next)
    setEditing(false)
  }

  return (
    <li className="block-row" data-testid="block-row">
      <span className="block-label">{block.label}</span>
      {editing ? (
        <input
          className="block-input"
          value={value}
          aria-label={`${block.label} answer`}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <span className="block-answer">{block.answer}</span>
      )}
      <span className="block-actions">
        <button type="button" className="action-btn" onClick={() => onMove(block.id, index - 1)} disabled={index === 0}>
          ↑<span className="sr-only"> move up</span>
        </button>
        <button type="button" className="action-btn" onClick={() => onMove(block.id, index + 1)} disabled={index === total - 1}>
          ↓<span className="sr-only"> move down</span>
        </button>
        {editing ? (
          <button type="button" className="action-btn" onClick={save}>Save</button>
        ) : (
          <button type="button" className="action-btn" onClick={() => { setValue(block.answer); setEditing(true) }}>Edit</button>
        )}
        <button type="button" className="action-btn" onClick={() => onRemove(block.id)}>Remove</button>
      </span>
    </li>
  )
}
```

```tsx
// src/ui/ProposalCard.tsx
import type { Proposal } from '../core/brief'

interface Props {
  proposal: Proposal
  loading: boolean
  onAccept: (option: string) => void
}

export default function ProposalCard({ proposal, loading, onAccept }: Props) {
  return (
    <div className="proposal-card" data-testid="proposal">
      <span className="block-label">{proposal.label}</span>
      <p className="proposal-question">{proposal.question}</p>
      <div className="proposal-options">
        {proposal.options.map((option) => (
          <button
            key={option}
            type="button"
            className="action-btn proposal-option"
            disabled={loading}
            onClick={() => onAccept(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
```

```tsx
// src/ui/BoardView.tsx
import { useState } from 'react'

import type { Brief, Proposal } from '../core/brief'
import BlockRow from './BlockRow'
import ProposalCard from './ProposalCard'

interface Props {
  brief: Brief
  draft: string
  proposal: Proposal | null
  loading: boolean
  note: string | null
  onAccept: (option: string) => void
  onAddOwn: (label: string, answer: string) => void
  onEdit: (id: string, answer: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, toIndex: number) => void
  onFinish: () => void
}

export default function BoardView({
  brief, draft, proposal, loading, note,
  onAccept, onAddOwn, onEdit, onRemove, onMove, onFinish,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')

  function submitOwn() {
    if (label.trim() === '' || detail.trim() === '') return
    onAddOwn(label.trim(), detail.trim())
    setLabel('')
    setDetail('')
    setAdding(false)
  }

  return (
    <section className="board">
      <div className="draft-panel">
        <span className="label">Your prompt so far</span>
        <p className="draft" data-testid="draft">{draft}</p>
      </div>

      {note && <p className="ai-note">{note}</p>}

      <ul className="block-list">
        {brief.blocks.map((block, index) => (
          <BlockRow
            key={block.id}
            block={block}
            index={index}
            total={brief.blocks.length}
            onEdit={onEdit}
            onRemove={onRemove}
            onMove={onMove}
          />
        ))}
      </ul>

      {proposal && <ProposalCard proposal={proposal} loading={loading} onAccept={onAccept} />}
      {loading && !proposal && <p className="ai-note">Thinking…</p>}

      {adding ? (
        <div className="add-block">
          <label className="add-field">
            Label
            <input className="block-input" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="add-field">
            Detail
            <input className="block-input" value={detail} onChange={(e) => setDetail(e.target.value)} />
          </label>
          <button type="button" className="action-btn" onClick={submitOwn}>Add</button>
        </div>
      ) : (
        <button type="button" className="action-btn add-block-btn" onClick={() => setAdding(true)}>
          + Add a block yourself
        </button>
      )}

      {brief.blocks.length > 0 && (
        <button type="button" className="action-btn finish-btn" onClick={onFinish}>
          Finish &amp; polish
        </button>
      )}
    </section>
  )
}
```

Append to `src/styles/app.css`:

```css
/* --- interview board --- */
.board { display: flex; flex-direction: column; gap: 1rem; }
.draft-panel { border: 1px solid var(--line, #444); border-radius: 10px; padding: 1rem; }
.draft { font-size: 1.05rem; line-height: 1.7; margin: 0.5rem 0 0; }
.block-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.block-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
  border: 1px solid var(--line, #444); border-radius: 8px; padding: 0.6rem 0.75rem; }
.block-label { font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.65; min-width: 5.5rem; }
.block-answer { flex: 1; }
.block-input { flex: 1; min-width: 8rem; }
.block-actions { display: flex; gap: 0.3rem; margin-left: auto; }
.proposal-card { border: 2px dashed var(--line, #666); border-radius: 10px; padding: 1rem; }
.proposal-question { margin: 0.5rem 0 0.75rem; font-weight: 600; }
.proposal-options { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.add-block { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end; }
.add-field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/BoardView.test.tsx`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/BlockRow.tsx src/ui/ProposalCard.tsx src/ui/BoardView.tsx src/ui/BoardView.test.tsx src/styles/app.css package.json package-lock.json
git commit -m "feat(ui): interview board — block rows, staged proposal, growing draft"
```

---

### Task 6: Wire the board into the app

**Files:**
- Modify: `src/ui/App.tsx` (replace the `generator` view; keep `favorites`)
- Create: `src/ui/SeedForm.tsx`
- Test: `src/ui/interviewFlow.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–5
- Produces: the `interview` view as the app's default tab

Model calls live here, using the existing ticket pattern (`sparkCounter` at `src/ui/App.tsx:49`) so a stale result cannot land after a settings flip. Cold start: when the user asks for an idea, `generate(randomSeed(), {})` supplies the seed phrase — the surviving role of the packs.

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/interviewFlow.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import App from './App'
import { SETTINGS_KEY } from '../state/settings'

describe('interview flow', () => {
  beforeEach(() => localStorage.clear())

  it('starts on the interview tab with a seed form', () => {
    render(<App />)
    expect(screen.getByLabelText(/rough idea/i)).toBeTruthy()
  })

  it('template mode places a block without any API key', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText(/rough idea/i), {
      target: { value: 'an app for fridge leftovers' },
    })
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => expect(screen.getByTestId('draft')).toBeTruthy())
    expect(screen.getByTestId('draft')).toHaveTextContent('an app for fridge leftovers')
  })

  it('offers a cold-start idea when the user has none', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /surprise me/i }))
    await waitFor(() => {
      expect((screen.getByLabelText(/rough idea/i) as HTMLInputElement).value.length).toBeGreaterThan(0)
    })
  })

  it('persists the brief across remounts', async () => {
    const { unmount } = render(<App />)
    fireEvent.change(screen.getByLabelText(/rough idea/i), { target: { value: 'a leftovers app' } })
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => expect(screen.getByTestId('draft')).toBeTruthy())
    unmount()
    render(<App />)
    expect(screen.getByTestId('draft')).toHaveTextContent('a leftovers app')
  })

  it('does not offer AI settings state that breaks the no-key path', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey: '', model: 'claude-opus-5', aiEnabled: true }))
    render(<App />)
    expect(screen.getByLabelText(/rough idea/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/interviewFlow.test.tsx`
Expected: FAIL — no `rough idea` label exists yet

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/SeedForm.tsx`:

```tsx
import { useState } from 'react'

interface Props {
  onStart: (idea: string) => void
  onSurprise: () => string
}

export default function SeedForm({ onStart, onSurprise }: Props) {
  const [idea, setIdea] = useState('')

  return (
    <section className="seed-form">
      <label className="seed-label" htmlFor="seed-idea">
        Your rough idea
      </label>
      <input
        id="seed-idea"
        className="block-input seed-input"
        value={idea}
        placeholder="an app that helps me use up leftovers"
        onChange={(e) => setIdea(e.target.value)}
      />
      <div className="seed-actions">
        <button
          type="button"
          className="action-btn"
          disabled={idea.trim() === ''}
          onClick={() => onStart(idea.trim())}
        >
          Start
        </button>
        <button type="button" className="action-btn" onClick={() => setIdea(onSurprise())}>
          Surprise me
        </button>
      </div>
    </section>
  )
}
```

In `src/ui/App.tsx`: replace the `generator` view and its state with the interview. Keep `favorites`. Remove the `scout` tab, `FilterBar`, `SurpriseHero`, `PromptCard`, share-link handling and `filters` state.

```tsx
import { useMemo, useRef, useState } from 'react'

import { AiError } from '../core/ai'
import {
  addBlock, createBrief, editBlock, moveBlock, removeBlock,
  type BlockKind, type Brief, type Proposal,
} from '../core/brief'
import { generate } from '../core/generate'
import { makeAnthropicClient, polish, proposeNext, writeSentence } from '../core/interview'
import { renderDraft, templateSentence } from '../core/render'
import { clearBrief, saveBrief, useBrief } from '../state/briefStore'
import { aiReady, useSettings } from '../state/settings'
import '../styles/app.css'
import BoardView from './BoardView'
import FavoritesView from './FavoritesView'
import SeedForm from './SeedForm'
import SettingsPanel from './SettingsPanel'

type View = 'interview' | 'favorites'

const TABS: { value: View; label: string }[] = [
  { value: 'interview', label: 'Interview' },
  { value: 'favorites', label: 'Favorites' },
]

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

export default function App() {
  const [view, setView] = useState<View>('interview')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [polished, setPolished] = useState<string | null>(null)

  const settings = useSettings()
  const brief = useBrief()
  const ticket = useRef(0)

  const draft = useMemo(() => (brief ? renderDraft(brief) : ''), [brief])
  const client = useMemo(
    () => (aiReady(settings) ? makeAnthropicClient(settings.apiKey, settings.model) : null),
    [settings.apiKey, settings.model, settings.aiEnabled],
  )

  function commit(next: Brief) {
    saveBrief(next)
  }

  async function askNext(current: Brief) {
    if (client === null) {
      setProposal(null)
      return
    }
    const mine = ++ticket.current
    setLoading(true)
    setNote(null)
    try {
      const next = await proposeNext(client, current)
      if (mine !== ticket.current) return
      setProposal(next)
    } catch (e) {
      if (mine !== ticket.current) return
      const err = e instanceof AiError ? e : new AiError('Unexpected error.', true)
      setNote(`${err.message} You can still add blocks yourself.`)
      setProposal(null)
    } finally {
      if (mine === ticket.current) setLoading(false)
    }
  }

  function handleStart(idea: string) {
    const fresh = createBrief(idea, Date.now())
    commit(fresh)
    setProposal(null)
    setPolished(null)
    void askNext(fresh)
  }

  function handleSurprise(): string {
    return generate(randomSeed(), {}).text
  }

  async function handleAccept(option: string) {
    if (!brief || !proposal) return
    const mine = ++ticket.current
    setLoading(true)
    let sentence = templateSentence(proposal.kind, proposal.label, option)
    if (client !== null) {
      try {
        sentence = await writeSentence(client, brief, proposal.kind, proposal.label, option)
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError('Unexpected error.', true)
        setNote(`${err.message} Used a plain sentence instead.`)
      }
    }
    if (mine !== ticket.current) return
    const next = addBlock(
      brief,
      { kind: proposal.kind, label: proposal.label, question: proposal.question, answer: option, sentence },
      Date.now(),
    )
    commit(next)
    setProposal(null)
    setLoading(false)
    void askNext(next)
  }

  function handleAddOwn(label: string, answer: string) {
    if (!brief) return
    const kind: BlockKind = 'custom'
    commit(
      addBlock(
        brief,
        { kind, label, question: null, answer, sentence: templateSentence(kind, label, answer) },
        Date.now(),
      ),
    )
  }

  function handleEdit(id: string, answer: string) {
    if (!brief) return
    const block = brief.blocks.find((b) => b.id === id)
    if (!block) return
    commit(editBlock(brief, id, { answer, sentence: templateSentence(block.kind, block.label, answer) }, Date.now()))
  }

  function handleRemove(id: string) {
    if (!brief) return
    commit(removeBlock(brief, id, Date.now()))
  }

  function handleMove(id: string, toIndex: number) {
    if (!brief) return
    commit(moveBlock(brief, id, toIndex, Date.now()))
  }

  async function handleFinish() {
    if (!brief) return
    if (client === null) {
      setPolished(draft)
      return
    }
    const mine = ++ticket.current
    setLoading(true)
    try {
      setPolished(await polish(client, draft))
    } catch {
      setPolished(draft)
    } finally {
      if (mine === ticket.current) setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Prompt Spark</h1>
        <button
          type="button"
          className="action-btn settings-toggle"
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          {aiReady(settings) ? '⚙︎ AI on' : '⚙︎ AI'}
        </button>
      </header>

      {settingsOpen && <SettingsPanel />}

      <nav className="tab-bar" aria-label="Sections">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={view === value ? 'tab-button tab-button--active' : 'tab-button'}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {view === 'interview' &&
          (brief === null ? (
            <SeedForm onStart={handleStart} onSurprise={handleSurprise} />
          ) : (
            <>
              <BoardView
                brief={brief}
                draft={draft}
                proposal={proposal}
                loading={loading}
                note={note}
                onAccept={handleAccept}
                onAddOwn={handleAddOwn}
                onEdit={handleEdit}
                onRemove={handleRemove}
                onMove={handleMove}
                onFinish={handleFinish}
              />
              {polished !== null && (
                <div className="polished-panel">
                  <span className="label">Polished</span>
                  <p className="draft" data-testid="polished">{polished}</p>
                </div>
              )}
              <button type="button" className="action-btn" onClick={() => { clearBrief(); setProposal(null); setPolished(null) }}>
                Start over
              </button>
            </>
          ))}
        {view === 'favorites' && <FavoritesView />}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/interviewFlow.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.tsx src/ui/SeedForm.tsx src/ui/interviewFlow.test.tsx src/styles/app.css
git commit -m "feat(ui): wire interview board into App, retire generator surface"
```

---

### Task 7: Retire dead code and unfreeze the contract

**Files:**
- Delete: `src/ui/FilterBar.tsx`, `src/ui/SurpriseHero.tsx`, `src/ui/PromptCard.tsx`, `src/ui/BrainScoutView.tsx`
- Delete: `src/ui/App.test.tsx`, `src/ui/aiFlow.test.tsx` (they test the retired generator surface)
- Modify: `src/core/types.ts` (replace the FROZEN header; keep `Favorite`, `FAVORITES_KEY`, `Subject`, `Difficulty`, `Template`, `GeneratedPrompt`, `Filters` — still used by `generate.ts` and the packs)
- Modify: `src/ui/FavoritesView.tsx` (migrate to the fixed `useFavorites` hook)

`generate.ts`, `brainScout.ts`, `share.ts`, `data/*` and their tests stay: `generate` powers cold start, and the rest are still green and cheap to keep. Deleting them is a separate decision, not this plan's.

- [ ] **Step 1: Run the full suite to record the baseline**

Run: `npx vitest run`
Expected: PASS. Note the count — retired-surface tests will disappear next.

- [ ] **Step 2: Delete the retired components and their tests**

```bash
git rm src/ui/FilterBar.tsx src/ui/SurpriseHero.tsx src/ui/PromptCard.tsx src/ui/BrainScoutView.tsx
git rm src/ui/App.test.tsx src/ui/aiFlow.test.tsx
```

- [ ] **Step 3: Replace the frozen header in `src/core/types.ts`**

Replace lines 1–4:

```ts
/**
 * Shared contract types.
 *
 * The former "FROZEN Layer 1 contract — do not edit after T-001" header was a
 * constraint of the overnight parallel build, where agents needed a stable
 * target. It is not a permanent rule. The 2026-08-10 interview-board design
 * supersedes it: Filters/Difficulty/GeneratedPrompt now serve only cold-start
 * generation, and Brief/Block in ./brief.ts are the live model.
 */
```

- [ ] **Step 4: Migrate `FavoritesView` to the fixed hook**

Replace its local `useState` + `subscribe` wiring with `useFavorites()` from `../state/favorites` (KI-1 was fixed in cycle 8; the workaround is no longer needed).

- [ ] **Step 5: Run the full suite and the build**

Run: `npx vitest run && npm run build`
Expected: PASS, build green

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: retire generator surface, unfreeze types contract, migrate FavoritesView"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: PASS, zero failures

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 3: Manual smoke in the browser**

Run: `npm run dev -- --port 5199 --strictPort`
Check, with no API key set: typing an idea and pressing Start shows the draft; "Surprise me" fills the field; adding a block yourself appends a sentence; Edit/Remove/↑/↓ change the draft; reload preserves the brief.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address smoke-test findings"
```

---

## Self-Review

**Spec coverage.** Block model → Task 1. Prose rendering and the frozen-sentence rule → Tasks 2, 3. Propose/place/repeat/confirm loop → Tasks 3, 6. `done: true` advisory exit → Task 3. Staged-proposal invariant → Tasks 3, 6. Persistence → Task 4. Board with add/edit/remove/reorder and user-added blocks → Tasks 5, 6. Cold start from packs → Task 6. Degraded no-key path → Tasks 2, 6. `AiError` reuse → Tasks 3, 6. Contract unfreeze and `FavoritesView` cleanup → Task 7.

**Known gap, stated rather than hidden:** the spec lists `share.ts` carrying a `Brief`. No task implements it — sharing a brief needs a URL-size decision (a multi-block brief will not fit a query string cleanly) that the spec does not settle. `share.ts` is left working as-is for template prompts. This is deferred, not forgotten.

**Type consistency.** `Brief`, `Block`, `BlockDraft`, `BlockKind`, `Proposal`, `ModelClient` are defined once and imported everywhere. `templateSentence(kind, label, answer)` and `renderDraft(brief)` keep the same signatures in Tasks 2, 6. `addBlock(brief, draft, now)` takes `BlockDraft` (no `id`) in every call site.
