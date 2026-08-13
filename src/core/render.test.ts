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
  it('reads as a prompt from the very first render', () => {
    expect(renderDraft(createBrief('a fridge app', T0))).toBe('Build a fridge app.')
  })

  it('does not re-wrap a seed that is already formed prose', () => {
    // Pack-generated seeds are complete prompts ending in punctuation —
    // wrapping them produced "Build Build an envelope-budgeting app…".
    expect(renderDraft(createBrief('Build a budgeting app with physics.', T0))).toBe(
      'Build a budgeting app with physics.',
    )
    expect(renderDraft(createBrief('Why not a plant app?', T0))).toBe('Why not a plant app?')
  })

  it('keeps the seed idea at the head once other blocks land', () => {
    const b = addBlock(createBrief('a fridge app', T0), block('wontDo', 'Leave out lists.'), T0)
    expect(renderDraft(b)).toBe('Build a fridge app. Leave out lists.')
  })

  it('drops the implicit seed lead once a real intent block supersedes it', () => {
    const b = addBlock(createBrief('a fridge app', T0), block('intent', 'Build a pantry tool.'), T0)
    expect(renderDraft(b)).toBe('Build a pantry tool.')
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
