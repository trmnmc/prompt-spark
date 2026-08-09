import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generate } from '../core/generate'
import App from './App'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    root = createRoot(container)
    root.render(<App />)
  })
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  localStorage.clear()
})

function click(el: Element | null) {
  if (!el) throw new Error('element not found')
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function textOf(el: Element | null): string {
  return el?.textContent ?? ''
}

describe('App shell', () => {
  it('renders all three tab buttons, generator active by default', () => {
    const tabs = Array.from(container.querySelectorAll('.tab-button'))
    const labels = tabs.map((t) => textOf(t))
    expect(labels).toEqual(['Generator', 'Brain Scout', 'Favorites'])

    const generatorTab = tabs.find((t) => textOf(t) === 'Generator')!
    expect(generatorTab.getAttribute('aria-pressed')).toBe('true')

    // generator view content: the hero button is present
    expect(container.querySelector('.surprise-hero')).not.toBeNull()
  })

  it('navigates to Brain Scout and Favorites sections, with no filter chips shown there', () => {
    const tabs = () => Array.from(container.querySelectorAll('.tab-button'))
    const scoutTab = tabs().find((t) => textOf(t) === 'Brain Scout')!
    click(scoutTab)

    expect(scoutTab.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.scout-view')).not.toBeNull()
    expect(container.querySelector('.surprise-hero')).toBeNull()
    expect(container.querySelectorAll('.filter-chip').length).toBe(0)

    const favTab = tabs().find((t) => textOf(t) === 'Favorites')!
    click(favTab)

    expect(favTab.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.favorites-view')).not.toBeNull()
    expect(textOf(container.querySelector('.empty-state'))).toBe('No favorites yet')
    expect(container.querySelectorAll('.filter-chip').length).toBe(0)
  })

  it('filter chips are present on the Generator tab', () => {
    expect(container.querySelectorAll('.filter-chip').length).toBeGreaterThan(0)
  })

  it('tapping the hero renders a real generated prompt card', () => {
    expect(container.querySelector('.prompt-card')).toBeNull()
    click(container.querySelector('.surprise-hero'))

    const card = container.querySelector('.prompt-card')
    expect(card).not.toBeNull()
    expect(textOf(card)).toContain('Twist:')

    const serial = card!.querySelector('.serial-tag')
    expect(textOf(serial)).toMatch(/^No [0-9A-F]{4}$/)
  })

  it('regenerating with a subject filter active yields a card whose subject chip matches', () => {
    // baseline generation, unfiltered
    click(container.querySelector('.surprise-hero'))
    expect(container.querySelector('.prompt-card')).not.toBeNull()

    const subjectRow = container.querySelector('[aria-label="Subject"]')!
    const lawChip = Array.from(subjectRow.querySelectorAll('.filter-chip')).find(
      (c) => textOf(c) === 'Law',
    )!
    click(lawChip)

    // regenerate with the filter now active
    click(container.querySelector('.surprise-hero'))

    const card = container.querySelector('.prompt-card')!
    const chips = Array.from(card.querySelectorAll('.tag-chip')).map((c) => textOf(c))
    expect(chips[0]).toBe('Law')
  })

  it('Copy puts the prompt text on the clipboard and flips to Copied!', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    click(container.querySelector('.surprise-hero'))
    const card = container.querySelector('.prompt-card')!
    const promptText = textOf(card.querySelector('.prompt-text'))
    const copyButton = card.querySelector('.copy-button') as HTMLButtonElement

    await act(async () => {
      copyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(writeText).toHaveBeenCalledWith(promptText)
    expect(textOf(copyButton)).toBe('Copied!')
  })

  it('Save adds the prompt to favorites by id and flips to Saved', () => {
    click(container.querySelector('.surprise-hero'))
    const card = container.querySelector('.prompt-card')!
    const saveButton = card.querySelector('.save-button') as HTMLButtonElement

    expect(textOf(saveButton)).toBe('Save')
    click(saveButton)
    expect(textOf(saveButton)).toBe('Saved ✓')

    const stored = JSON.parse(localStorage.getItem('prompt-spark:favorites:v1') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].kind).toBe('prompt')
  })

  it('filter chips apply conjunctive subject + difficulty filters, empty = all', () => {
    const subjectRow = container.querySelector('[aria-label="Subject"]')!
    const difficultyRow = container.querySelector('[aria-label="Difficulty"]')!

    const allChip = subjectRow.querySelector('.filter-chip')!
    expect(allChip.getAttribute('aria-pressed')).toBe('true')

    const lawChip = Array.from(subjectRow.querySelectorAll('.filter-chip')).find(
      (c) => textOf(c) === 'Law',
    )!
    click(lawChip)
    expect(lawChip.getAttribute('aria-pressed')).toBe('true')
    expect(allChip.getAttribute('aria-pressed')).toBe('false')

    const hardChip = Array.from(difficultyRow.querySelectorAll('.filter-chip')).find(
      (c) => textOf(c) === 'Hard',
    )!
    click(hardChip)
    expect(hardChip.getAttribute('aria-pressed')).toBe('true')

    // both filters set simultaneously (conjunctive) — law is untouched
    expect(lawChip.getAttribute('aria-pressed')).toBe('true')

    // toggling law off again returns subject to "all"
    click(lawChip)
    expect(lawChip.getAttribute('aria-pressed')).toBe('false')
    expect(allChip.getAttribute('aria-pressed')).toBe('true')
    // difficulty filter is untouched by the subject toggle
    expect(hardChip.getAttribute('aria-pressed')).toBe('true')
  })

  it('bootstraps from a share-link URL on mount, rendering the string-identical shared prompt', () => {
    // Replace the default-mounted app (empty search) with one mounted
    // against a stubbed share URL, per jsdom convention: set location via
    // history.replaceState before the render that reads it.
    act(() => {
      root.unmount()
    })
    container.remove()

    history.replaceState(null, '', '/?seed=123&subject=law')

    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
      root.render(<App />)
    })

    const card = container.querySelector('.prompt-card')
    expect(card).not.toBeNull()
    expect(textOf(card!.querySelector('.prompt-text'))).toBe(generate(123, { subject: 'law' }).text)

    // Restore a plain URL so later tests see the normal empty-search state.
    history.replaceState(null, '', '/')
  })

  it('Copy share link writes a URL containing seed= to the clipboard and flips to Link copied!', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    click(container.querySelector('.surprise-hero'))
    const shareButton = container.querySelector('.share-link-button') as HTMLButtonElement
    expect(shareButton).not.toBeNull()
    expect(textOf(shareButton)).toBe('Copy share link \u{1F517}')

    await act(async () => {
      shareButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(writeText).toHaveBeenCalledTimes(1)
    const written = writeText.mock.calls[0][0] as string
    expect(written).toContain('seed=')
    expect(textOf(shareButton)).toBe('Link copied!')
  })
})
