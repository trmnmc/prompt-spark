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
