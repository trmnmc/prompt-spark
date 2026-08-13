import { describe, expect, it } from 'vitest'

import { AiError } from './ai'
import { addBlock, createBrief } from './brief'
import type { ModelClient } from './interview'
import { chipToProposal, polish, proposeNext, sketchOutcome, writeSentence } from './interview'

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
    const bad = JSON.stringify({
      done: false,
      kind: 'nonsense',
      label: 'X',
      question: 'Q',
      options: ['a', 'b'],
    })
    await expect(proposeNext(stub(bad), createBrief('x', T0))).rejects.toBeInstanceOf(AiError)
  })

  it('rejects fewer than two options', async () => {
    const bad = JSON.stringify({
      done: false,
      kind: 'whoFor',
      label: 'X',
      question: 'Q',
      options: ['only'],
    })
    await expect(proposeNext(stub(bad), createBrief('x', T0))).rejects.toBeInstanceOf(AiError)
  })

  it('caps options at four', async () => {
    const many = JSON.stringify({
      done: false,
      kind: 'whoFor',
      label: 'X',
      question: 'Q',
      options: ['a', 'b', 'c', 'd', 'e', 'f'],
    })
    const p = await proposeNext(stub(many), createBrief('x', T0))
    expect(p?.options).toEqual(['a', 'b', 'c', 'd'])
  })

  it('rejects unparseable JSON as AiError', async () => {
    await expect(proposeNext(stub('not json'), createBrief('x', T0))).rejects.toBeInstanceOf(
      AiError,
    )
  })

  it('tolerates a markdown-fenced JSON payload', async () => {
    const fenced = '```json\n' + GOOD + '\n```'
    const p = await proposeNext(stub(fenced), createBrief('x', T0))
    expect(p?.kind).toBe('whoFor')
  })

  it('passes AiError through untouched', async () => {
    const err = new AiError('rate limited', true)
    await expect(proposeNext(throwing(err), createBrief('x', T0))).rejects.toBe(err)
  })

  it('tells the model which kinds are already placed', async () => {
    let brief = createBrief('x', T0)
    brief = addBlock(
      brief,
      { kind: 'whoFor', label: 'Who for', question: 'q', answer: 'me', sentence: 'For me.' },
      T0,
    )
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
    const s = await writeSentence(
      stub('  Build a fridge tool.  '),
      createBrief('x', T0),
      'intent',
      'Intent',
      'a fridge tool',
    )
    expect(s).toBe('Build a fridge tool.')
  })

  it('rejects an empty sentence as AiError', async () => {
    await expect(
      writeSentence(stub('   '), createBrief('x', T0), 'intent', 'Intent', 'a thing'),
    ).rejects.toBeInstanceOf(AiError)
  })

  it('strips surrounding quotes the model sometimes adds', async () => {
    const s = await writeSentence(
      stub('"Build a thing."'),
      createBrief('x', T0),
      'intent',
      'Intent',
      'a thing',
    )
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

describe('sketchOutcome', () => {
  const GOOD_SKETCH = JSON.stringify({
    outcome: 'A single-page app with a watering dashboard. It will not include camera ID.',
    guesses: [
      { topic: 'Data storage', assumption: 'plant list kept in localStorage' },
      { topic: 'Reminders', assumption: 'no notifications, dashboard only' },
    ],
  })

  it('parses outcome and guesses, assigning stable ids', async () => {
    const r = await sketchOutcome(stub(GOOD_SKETCH), createBrief('plants', T0))
    expect(r.outcome).toContain('watering dashboard')
    expect(r.guesses).toHaveLength(2)
    expect(r.guesses[0].id).toMatch(/^[0-9A-F]+$/)
    expect(r.guesses[0].topic).toBe('Data storage')
    expect(r.guesses[0].id).not.toBe(r.guesses[1].id)
  })

  it('truncates guesses to five', async () => {
    const many = JSON.stringify({
      outcome: 'ok',
      guesses: Array.from({ length: 8 }, (_, i) => ({ topic: `t${i}`, assumption: `a${i}` })),
    })
    const r = await sketchOutcome(stub(many), createBrief('x', T0))
    expect(r.guesses).toHaveLength(5)
  })

  it('degrades missing or malformed guesses to an empty list', async () => {
    const noGuesses = JSON.stringify({ outcome: 'still useful' })
    expect((await sketchOutcome(stub(noGuesses), createBrief('x', T0))).guesses).toEqual([])
    const badGuesses = JSON.stringify({ outcome: 'ok', guesses: [{ topic: 42 }, 'nope'] })
    expect((await sketchOutcome(stub(badGuesses), createBrief('x', T0))).guesses).toEqual([])
  })

  it('rejects an empty or missing outcome as AiError', async () => {
    await expect(
      sketchOutcome(stub(JSON.stringify({ outcome: '  ', guesses: [] })), createBrief('x', T0)),
    ).rejects.toBeInstanceOf(AiError)
    await expect(sketchOutcome(stub('not json'), createBrief('x', T0))).rejects.toBeInstanceOf(
      AiError,
    )
  })

  it('tolerates a markdown-fenced payload', async () => {
    const fenced = '```json\n' + GOOD_SKETCH + '\n```'
    expect((await sketchOutcome(stub(fenced), createBrief('x', T0))).guesses).toHaveLength(2)
  })
})

describe('chipToProposal', () => {
  const guess = { id: 'A1', topic: 'Data storage', assumption: 'kept in localStorage' }
  const GOOD_CHIP = JSON.stringify({
    kind: 'inputs',
    label: 'Data Storage',
    question: 'Where should the plant list live?',
    options: ['kept in localStorage', 'a JSON file I export', 'a tiny backend'],
  })

  it('returns a valid Proposal with the assumption as first option', async () => {
    const p = await chipToProposal(stub(GOOD_CHIP), createBrief('plants', T0), guess)
    expect(p.options[0]).toBe('kept in localStorage')
    expect(p.kind).toBe('inputs')
  })

  it('forces the assumption to first position if the model buried it', async () => {
    const buried = JSON.stringify({
      kind: 'inputs',
      label: 'Data Storage',
      question: 'Where?',
      options: ['a tiny backend', 'kept in localStorage'],
    })
    const p = await chipToProposal(stub(buried), createBrief('x', T0), guess)
    expect(p.options[0]).toBe('kept in localStorage')
  })

  it('prepends the assumption when the model omitted it entirely', async () => {
    const missing = JSON.stringify({
      kind: 'inputs',
      label: 'Data Storage',
      question: 'Where?',
      options: ['a backend', 'a JSON file'],
    })
    const p = await chipToProposal(stub(missing), createBrief('x', T0), guess)
    expect(p.options[0]).toBe('kept in localStorage')
    expect(p.options).toHaveLength(3)
  })

  it('rejects malformed payloads as AiError', async () => {
    await expect(chipToProposal(stub('null'), createBrief('x', T0), guess)).rejects.toBeInstanceOf(
      AiError,
    )
  })
})
