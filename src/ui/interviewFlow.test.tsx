import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearBrief } from '../state/briefStore'
import { SETTINGS_KEY } from '../state/settings'
import App from './App'

// React 19 requires this flag before act() will drive updates in a non-DOM-
// test-runner environment.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

/**
 * Reset through clearBrief(), not a bare localStorage.clear(): the store
 * caches its snapshot at module scope (required by useSyncExternalStore) and
 * only invalidates on its own writes, so wiping the backing store behind its
 * back leaves the previous test's brief live in memory.
 */
beforeEach(() => {
  localStorage.clear()
  clearBrief()
  window.history.replaceState(null, '', '/')
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  clearBrief()
})

function mount() {
  act(() => {
    root = createRoot(container)
    root.render(<App />)
  })
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').toLowerCase().includes(label.toLowerCase()),
  )
  if (!found) throw new Error(`button "${label}" not found`)
  return found
}

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function seedInput(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>('#seed-idea')
  if (!el) throw new Error('seed input not found')
  return el
}

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function draftText(): string {
  return container.querySelector('[data-testid="draft"]')?.textContent ?? ''
}

describe('interview flow', () => {
  it('starts on the interview tab with a seed form', () => {
    mount()
    expect(seedInput()).toBeTruthy()
  })

  it('template mode starts a brief without any API key', () => {
    mount()
    type(seedInput(), 'an app for fridge leftovers')
    click(button('start'))
    expect(draftText()).toContain('an app for fridge leftovers')
  })

  it('offers a cold-start idea when the user has none', () => {
    mount()
    click(button('surprise me'))
    expect(seedInput().value.length).toBeGreaterThan(0)
  })

  it('adding a block yourself grows the draft', () => {
    mount()
    type(seedInput(), 'a leftovers app')
    click(button('start'))
    click(button('add a block'))
    const inputs = container.querySelectorAll<HTMLInputElement>('.add-block input')
    type(inputs[0], 'Budget')
    type(inputs[1], 'under $10 a month')
    click(button('add'))
    expect(draftText()).toContain('Budget: under $10 a month.')
  })

  it('persists the brief across remounts', () => {
    mount()
    type(seedInput(), 'a leftovers app')
    click(button('start'))
    expect(draftText()).toContain('a leftovers app')
    act(() => root.unmount())
    mount()
    expect(draftText()).toContain('a leftovers app')
  })

  it('preview gate: Copy exists only on the preview, and mutations drop it', () => {
    mount()
    type(seedInput(), 'a leftovers app')
    click(button('start'))
    // No copy affordance anywhere before previewing:
    expect(
      Array.from(container.querySelectorAll('button')).some((b) =>
        (b.textContent ?? '').toLowerCase().includes('copy'),
      ),
    ).toBe(false)
    click(button('preview what'))
    expect(container.querySelector('[data-testid="preview"]')).toBeTruthy()
    expect(button('looks right')).toBeTruthy()
    // No-key path: prompt slot holds the raw draft, no outcome, no chips:
    expect(container.querySelector('[data-testid="preview-prompt"]')?.textContent).toContain(
      'a leftovers app',
    )
    expect(container.querySelector('[data-testid="preview-outcome"]')).toBeNull()
    // Mutation drops the preview and its Copy:
    click(button('add a block'))
    const inputs = container.querySelectorAll<HTMLInputElement>('.add-block input')
    type(inputs[0], 'Budget')
    type(inputs[1], 'cheap')
    click(button('add'))
    expect(container.querySelector('[data-testid="preview"]')).toBeNull()
  })

  it('copy puts exactly the previewed text on the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mount()
    type(seedInput(), 'a leftovers app')
    click(button('start'))
    click(button('preview what'))
    const shown = container.querySelector('[data-testid="preview-prompt"]')?.textContent
    click(button('looks right'))
    await act(async () => {})
    expect(writeText).toHaveBeenCalledWith(shown)
  })

  it('renders a note exactly once when the preview is open', async () => {
    // Break the clipboard so Copy sets the failure note while the preview
    // is showing — the note must not render in both BoardView and the panel.
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    mount()
    type(seedInput(), 'a leftovers app')
    click(button('start'))
    click(button('preview what'))
    click(button('looks right'))
    await act(async () => {})
    expect(container.querySelectorAll('.ai-note')).toHaveLength(1)
  })

  it('start over clears the brief and returns to the seed form', () => {
    mount()
    type(seedInput(), 'a leftovers app')
    click(button('start'))
    click(button('start over'))
    expect(seedInput()).toBeTruthy()
  })

  it('stays on the no-key path when AI is enabled but the key is blank', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ apiKey: '', model: 'claude-opus-5', aiEnabled: true }),
    )
    mount()
    type(seedInput(), 'a leftovers app')
    click(button('start'))
    expect(draftText()).toContain('a leftovers app')
  })
})
