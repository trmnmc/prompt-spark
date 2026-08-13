import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PreviewPanel from './PreviewPanel'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const guesses = [
  { id: 'A1', topic: 'Data storage', assumption: 'localStorage' },
  { id: 'B2', topic: 'Reminders', assumption: 'none' },
]
const base = {
  polished: 'Build the plant app.',
  outcome: 'One dashboard screen. It will not include camera ID.' as string | null,
  guesses,
  note: null as string | null,
  onCopy: () => {},
  onBack: () => {},
  onPin: (_g: (typeof guesses)[0]) => {},
  copied: false,
}

function mount(over: Partial<typeof base> = {}) {
  act(() => {
    root = createRoot(container)
    root.render(<PreviewPanel {...base} {...over} />)
  })
}
function button(label: string): HTMLButtonElement {
  const b = Array.from(container.querySelectorAll('button')).find((x) =>
    (x.textContent ?? '').toLowerCase().includes(label.toLowerCase()),
  )
  if (!b) throw new Error(`button ${label} not found`)
  return b
}
function click(el: Element) {
  act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

describe('PreviewPanel', () => {
  it('renders prompt, outcome, and one chip per guess', () => {
    mount()
    expect(container.textContent).toContain('Build the plant app.')
    expect(container.textContent).toContain('One dashboard screen')
    expect(container.querySelectorAll('[data-testid="guess-chip"]')).toHaveLength(2)
  })

  it('has exactly one copy affordance and fires onCopy', () => {
    const onCopy = vi.fn()
    mount({ onCopy })
    const copies = Array.from(container.querySelectorAll('button')).filter((b) =>
      (b.textContent ?? '').toLowerCase().includes('copy'),
    )
    expect(copies).toHaveLength(1)
    click(copies[0])
    expect(onCopy).toHaveBeenCalledOnce()
  })

  it('fires onPin with the clicked guess', () => {
    const onPin = vi.fn()
    mount({ onPin })
    click(container.querySelectorAll('[data-testid="guess-chip"]')[1])
    expect(onPin).toHaveBeenCalledWith(guesses[1])
  })

  it('renders without outcome (degraded sketch) and shows the note', () => {
    mount({ outcome: null, guesses: [], note: 'Sketch unavailable.' })
    expect(container.textContent).toContain('Sketch unavailable.')
    expect(container.textContent).toContain('Build the plant app.')
    expect(container.querySelector('[data-testid="preview-outcome"]')).toBeNull()
  })

  it('shows copied state', () => {
    mount({ copied: true })
    expect(button('copied').textContent).toContain('Copied')
  })

  it('fires onBack', () => {
    const onBack = vi.fn()
    mount({ onBack })
    click(button('back to the board'))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
