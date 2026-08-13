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
