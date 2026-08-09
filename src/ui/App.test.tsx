import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import App from './App'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
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

  it('navigates to Brain Scout and Favorites sections', () => {
    const tabs = () => Array.from(container.querySelectorAll('.tab-button'))
    const scoutTab = tabs().find((t) => textOf(t) === 'Brain Scout')!
    click(scoutTab)

    expect(scoutTab.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.scout-view')).not.toBeNull()
    expect(container.querySelector('.surprise-hero')).toBeNull()

    const favTab = tabs().find((t) => textOf(t) === 'Favorites')!
    click(favTab)

    expect(favTab.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.favorites-view')).not.toBeNull()
    expect(textOf(container.querySelector('.empty-state'))).toBe('No favorites yet')
  })

  it('tapping the hero shows a seed placeholder card', () => {
    expect(container.querySelector('.prompt-card')).toBeNull()
    click(container.querySelector('.surprise-hero'))

    const card = container.querySelector('.hero-area .prompt-card')
    expect(card).not.toBeNull()
    expect(textOf(card)).toMatch(/^Seed no\. \d+ ready — generator wiring lands soon$/)
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
})
