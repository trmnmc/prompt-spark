/**
 * Regression tests for the AI-flow reviewer findings: stale AI prompt on
 * filter change, in-flight invalidation on settings change, URL scrubbing,
 * and phrase trimming. The ai module is mocked; template mode is real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

const aiGenerateMock = vi.fn()
const aiScoutMock = vi.fn()
vi.mock('../core/ai', () => ({
  aiGenerate: (...a: unknown[]) => aiGenerateMock(...a),
  aiScout: (...a: unknown[]) => aiScoutMock(...a),
  AiError: class AiError extends Error {
    recoverable: boolean
    constructor(m: string, r: boolean) {
      super(m)
      this.name = 'AiError'
      this.recoverable = r
    }
  },
}))

import App from './App'
import { saveSettings } from '../state/settings'
import type { GeneratedPrompt } from '../core/types'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const AI_PROMPT: GeneratedPrompt = {
  id: 'ABCD1234',
  text: 'An AI-written law prompt. Twist: it rhymes.',
  subject: 'law',
  difficulty: 'easy',
  timeBand: '1–2 hours',
  seed: -1,
  templateId: 'ai',
  serial: 'ABCD',
}

let root: Root
let el: HTMLDivElement

function clickByText(pattern: RegExp): void {
  const btn = [...el.querySelectorAll('button')].find((b) => pattern.test(b.textContent ?? ''))
  if (!btn) throw new Error(`no button matching ${pattern}`)
  act(() => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
  aiGenerateMock.mockReset()
  aiScoutMock.mockReset()
  document.body.innerHTML = ''
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
})

describe('AI flow regressions', () => {
  it('filter change clears a displayed AI prompt (no mismatched chips)', async () => {
    saveSettings({ aiEnabled: true, apiKey: 'sk-ant-x' })
    aiGenerateMock.mockResolvedValue(AI_PROMPT)
    act(() => {
      root.render(React.createElement(App))
    })
    clickByText(/surprise me|sparking/i)
    await flush()
    expect(el.querySelector('.prompt-card')?.textContent).toContain('AI-written law prompt')
    clickByText(/^Finance$/)
    await flush()
    // The stale law-tagged AI card must be gone (empty state or template card)
    expect(el.textContent).not.toContain('AI-written law prompt')
  })

  it('AI prompt on screen scrubs the share query from the URL', async () => {
    saveSettings({ aiEnabled: true, apiKey: 'sk-ant-x' })
    aiGenerateMock.mockResolvedValue(AI_PROMPT)
    history.replaceState(null, '', '/?seed=123&subject=law')
    act(() => {
      root.render(React.createElement(App))
    })
    expect(window.location.search).toContain('seed=') // template bootstrap kept it
    clickByText(/surprise me|sparking/i)
    await flush()
    expect(window.location.search).toBe('') // AI prompt visible -> no stale share URL
  })

  it('disabling AI mid-flight drops the late result', async () => {
    saveSettings({ aiEnabled: true, apiKey: 'sk-ant-x' })
    let resolveCall: (p: GeneratedPrompt) => void = () => {}
    aiGenerateMock.mockImplementation(
      () => new Promise<GeneratedPrompt>((res) => (resolveCall = res)),
    )
    act(() => {
      root.render(React.createElement(App))
    })
    clickByText(/surprise me|sparking/i)
    await flush()
    act(() => {
      saveSettings({ aiEnabled: false }) // invalidates the in-flight ticket
    })
    await flush()
    act(() => {
      resolveCall(AI_PROMPT)
    })
    await flush()
    expect(el.textContent).not.toContain('AI-written law prompt')
  })

  it('scout trims the phrase before calling the AI', async () => {
    saveSettings({ aiEnabled: true, apiKey: 'sk-ant-x' })
    aiScoutMock.mockResolvedValue({
      seedPhrase: 'tidy idea',
      rungs: [
        { rung: 'Weekend', text: 'tidy idea w', id: '1' },
        { rung: 'Week', text: 'tidy idea x', id: '2' },
        { rung: 'Month', text: 'tidy idea y', id: '3' },
        { rung: 'Moonshot', text: 'tidy idea z', id: '4' },
      ],
      remixes: [
        { lens: 'a', subject: 'law', text: 'tidy idea 1', id: '5' },
        { lens: 'b', subject: 'finance', text: 'tidy idea 2', id: '6' },
        { lens: 'c', subject: 'science', text: 'tidy idea 3', id: '7' },
      ],
    })
    act(() => {
      root.render(React.createElement(App))
    })
    clickByText(/brain scout/i)
    const input = el.querySelector('input[aria-label="Seed idea"]') as HTMLInputElement
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, '  tidy idea  ')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => {
      input
        .closest('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await flush()
    expect(aiScoutMock).toHaveBeenCalledWith('sk-ant-x', 'claude-opus-5', 'tidy idea')
    expect(el.querySelectorAll('.ladder-rung').length).toBe(4)
  })
})
