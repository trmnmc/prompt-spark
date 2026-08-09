import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the SDK before importing the module under test. The mock class is
// hoisted; error classes must remain instanceof-able for toAiError.
const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class MockAnthropic {
    messages = { create: createMock }
    static APIError = APIError
    static AuthenticationError = AuthenticationError
    static RateLimitError = RateLimitError
  }
  return { default: MockAnthropic }
})

import Anthropic from '@anthropic-ai/sdk'
import { aiGenerate, aiScout, AiError } from './ai'
import { LADDER_RUNGS } from './types'

const KEY = 'sk-ant-test'
const MODEL = 'claude-opus-5' as const

function textResponse(text: string, stop = 'end_turn') {
  return { stop_reason: stop, content: [{ type: 'text', text }] }
}

beforeEach(() => {
  createMock.mockReset()
})

describe('aiGenerate', () => {
  it('returns a GeneratedPrompt with AI markers and honored filters', async () => {
    createMock.mockResolvedValue(
      textResponse('Build a rent-split roulette for roommates. Twist: chores are currency.'),
    )
    const p = await aiGenerate(KEY, MODEL, { subject: 'realEstate', difficulty: 'easy' })
    expect(p.subject).toBe('realEstate')
    expect(p.difficulty).toBe('easy')
    expect(p.timeBand).toBe('1–2 hours')
    expect(p.seed).toBe(-1)
    expect(p.templateId).toBe('ai')
    expect(p.serial).toMatch(/^[0-9A-F]{4}$/)
    expect(p.text).toContain('Twist:')
    const req = createMock.mock.calls[0][0]
    expect(req.model).toBe(MODEL)
    expect(req.output_config.effort).toBe('low')
  })

  it('maps refusal to a recoverable AiError', async () => {
    createMock.mockResolvedValue(textResponse('', 'refusal'))
    await expect(aiGenerate(KEY, MODEL, {})).rejects.toMatchObject({
      name: 'AiError',
      recoverable: true,
    })
  })

  it('maps AuthenticationError to a NON-recoverable AiError', async () => {
    createMock.mockRejectedValue(new (Anthropic as any).AuthenticationError('bad key'))
    await expect(aiGenerate(KEY, MODEL, {})).rejects.toMatchObject({ recoverable: false })
  })

  it('maps empty text to a recoverable AiError', async () => {
    createMock.mockResolvedValue(textResponse('   '))
    await expect(aiGenerate(KEY, MODEL, {})).rejects.toBeInstanceOf(AiError)
  })

  it('regression: max_tokens truncation is a recoverable AiError, not a rendered partial', async () => {
    createMock.mockResolvedValue(textResponse('Build a thing that got cut o', 'max_tokens'))
    await expect(aiGenerate(KEY, MODEL, {})).rejects.toMatchObject({
      name: 'AiError',
      recoverable: true,
    })
  })

  it('regression: text without a Twist sentence is rejected as incomplete', async () => {
    createMock.mockResolvedValue(textResponse('A complete-looking prompt with no twist at all.'))
    await expect(aiGenerate(KEY, MODEL, {})).rejects.toMatchObject({ recoverable: true })
  })
})

describe('aiScout', () => {
  const PHRASE = 'time travel diary'
  const goodPayload = () => ({
    rungs: LADDER_RUNGS.map((rung) => ({
      rung,
      text: `${rung} take on "${PHRASE}": build the thing, then more of the thing.`,
    })),
    remixes: [
      { lens: 'compound-interest visualizers', subject: 'finance', text: `Chart your ${PHRASE} entries.` },
      { lens: 'tenant rights', subject: 'law', text: `A ${PHRASE} for lease events.` },
      { lens: 'simulation sandboxes', subject: 'science', text: `Simulate a ${PHRASE} branching.` },
    ],
  })

  it('parses a valid structured response into ScoutResult with stable ids', async () => {
    createMock.mockResolvedValue(textResponse(JSON.stringify(goodPayload())))
    const r = await aiScout(KEY, MODEL, PHRASE)
    expect(r.seedPhrase).toBe(PHRASE)
    expect(r.rungs.map((x) => x.rung)).toEqual([...LADDER_RUNGS])
    for (const rung of r.rungs) expect(rung.text).toContain(PHRASE)
    expect(r.remixes).toHaveLength(3)
    expect(new Set(r.remixes.map((x) => x.lens)).size).toBe(3)
    // ids follow the same scout id scheme as template mode (djb2 hex)
    for (const rung of r.rungs) expect(rung.id).toMatch(/^[0-9A-F]+$/)
    // structured output requested
    const req = createMock.mock.calls[0][0]
    expect(req.output_config.format.type).toBe('json_schema')
  })

  it('rejects when a rung is missing or lacks the verbatim phrase', async () => {
    const bad = goodPayload()
    bad.rungs[1].text = 'a rung that forgot the phrase entirely'
    createMock.mockResolvedValue(textResponse(JSON.stringify(bad)))
    await expect(aiScout(KEY, MODEL, PHRASE)).rejects.toMatchObject({ recoverable: true })
  })

  it('rejects when fewer than 3 valid distinct-lens remixes survive', async () => {
    const bad = goodPayload()
    bad.remixes[2].lens = bad.remixes[1].lens // duplicate lens
    createMock.mockResolvedValue(textResponse(JSON.stringify(bad)))
    await expect(aiScout(KEY, MODEL, PHRASE)).rejects.toMatchObject({ recoverable: true })
  })

  it('maps unparseable output to a recoverable AiError', async () => {
    createMock.mockResolvedValue(textResponse('not json at all'))
    await expect(aiScout(KEY, MODEL, PHRASE)).rejects.toMatchObject({ recoverable: true })
  })

  it('regression: schema-noncompliant JSON surfaces as AiError, never a raw TypeError', async () => {
    createMock.mockResolvedValue(textResponse('{"rungs":null,"remixes":[]}'))
    await expect(aiScout(KEY, MODEL, PHRASE)).rejects.toBeInstanceOf(AiError)
    createMock.mockResolvedValue(textResponse('null'))
    await expect(aiScout(KEY, MODEL, PHRASE)).rejects.toBeInstanceOf(AiError)
    createMock.mockResolvedValue(textResponse('{"rungs":5,"remixes":"x"}'))
    await expect(aiScout(KEY, MODEL, PHRASE)).rejects.toBeInstanceOf(AiError)
  })

  it('regression: max_tokens truncation in scout is a recoverable AiError', async () => {
    createMock.mockResolvedValue(textResponse('{"rungs":[', 'max_tokens'))
    await expect(aiScout(KEY, MODEL, PHRASE)).rejects.toMatchObject({ recoverable: true })
  })
})
