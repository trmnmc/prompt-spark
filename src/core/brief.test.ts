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
    expect(moveBlock(b, b.blocks[0].id, 99, T0 + 3).blocks.map((x) => x.answer)).toEqual([
      'two',
      'one',
    ])
    expect(moveBlock(b, b.blocks[0].id, -5, T0 + 3).blocks.map((x) => x.answer)).toEqual([
      'one',
      'two',
    ])
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
