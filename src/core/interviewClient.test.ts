import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the SDK before importing the module under test, mirroring ai.test.ts.
// Error classes must stay instanceof-able so toAiError can discriminate them.
const createMock = vi.fn()
const ctorCalls: Record<string, unknown>[] = []

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class MockAnthropic {
    messages = { create: createMock }
    static APIError = APIError
    static AuthenticationError = AuthenticationError
    static RateLimitError = RateLimitError
    constructor(opts: Record<string, unknown>) {
      ctorCalls.push(opts)
    }
  }
  return { default: MockAnthropic, APIError, AuthenticationError, RateLimitError }
})

const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as {
  AuthenticationError: new (m: string) => Error
  RateLimitError: new (m: string) => Error
}
const { AiError } = await import('./ai')
const { makeAnthropicClient } = await import('./interview')

const ok = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] }

beforeEach(() => {
  createMock.mockReset()
  ctorCalls.length = 0
})

describe('makeAnthropicClient error mapping', () => {
  it('maps an SDK auth failure to a non-recoverable AiError, not "Unexpected error"', async () => {
    createMock.mockRejectedValue(new Anthropic.AuthenticationError('401 unauthorized'))
    const client = makeAnthropicClient('sk-bad', 'claude-opus-5')
    const err = await client.complete({ system: 's', user: 'u', maxTokens: 10 }).catch((e) => e)
    expect(err).toBeInstanceOf(AiError)
    expect(err.message).toContain('Invalid API key')
    expect(err.recoverable).toBe(false)
  })

  it('maps a rate limit to a recoverable AiError', async () => {
    createMock.mockRejectedValue(new Anthropic.RateLimitError('429'))
    const client = makeAnthropicClient('sk-x', 'claude-opus-5')
    const err = await client.complete({ system: 's', user: 'u', maxTokens: 10 }).catch((e) => e)
    expect(err).toBeInstanceOf(AiError)
    expect(err.recoverable).toBe(true)
  })

  it('maps an unknown throw to an AiError rather than letting it escape raw', async () => {
    createMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const client = makeAnthropicClient('sk-x', 'claude-opus-5')
    const err = await client.complete({ system: 's', user: 'u', maxTokens: 10 }).catch((e) => e)
    expect(err).toBeInstanceOf(AiError)
    expect(err.message).not.toBe('Unexpected error.')
  })
})

describe('makeAnthropicClient gateway wiring', () => {
  it('talks to Anthropic directly and sends output_config when no gateway is set', async () => {
    createMock.mockResolvedValue(ok)
    await makeAnthropicClient('sk-x', 'claude-opus-5').complete({
      system: 's',
      user: 'u',
      maxTokens: 10,
    })
    expect(ctorCalls[0].baseURL).toBeUndefined()
    expect(ctorCalls[0].defaultHeaders).toBeUndefined()
    expect(createMock.mock.calls[0][0].output_config).toEqual({ effort: 'low' })
  })

  it('sets baseURL, adds a bearer header, and drops output_config on a gateway', async () => {
    createMock.mockResolvedValue(ok)
    await makeAnthropicClient('sk-or-x', 'anthropic/claude-sonnet-4.5', 'https://openrouter.ai/api')
      .complete({ system: 's', user: 'u', maxTokens: 10 })
    expect(ctorCalls[0].baseURL).toBe('https://openrouter.ai/api')
    expect(ctorCalls[0].defaultHeaders).toEqual({ Authorization: 'Bearer sk-or-x' })
    const body = createMock.mock.calls[0][0]
    expect(body.output_config).toBeUndefined()
    expect(body.model).toBe('anthropic/claude-sonnet-4.5')
  })
})
