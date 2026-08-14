import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import NorthstarApp from './NorthstarApp'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    root = createRoot(container)
    root.render(<NorthstarApp />)
  })
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function button(label: string): HTMLButtonElement {
  const b = Array.from(container.querySelectorAll('button')).find((x) =>
    (x.textContent ?? '').toLowerCase().includes(label.toLowerCase()),
  )
  if (!b) throw new Error(`button "${label}" not found`)
  return b
}
function click(el: Element) {
  act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}
function typeInto(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  act(() => {
    setter?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function textarea(): HTMLTextAreaElement {
  const el = container.querySelector('textarea')
  if (!el) throw new Error('textarea not found')
  return el
}

describe('Northstar shell', () => {
  it('opens on Describe with the compass showing seven steps', () => {
    expect(container.querySelector('[data-testid="screen-describe"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-testid="compass-step"]')).toHaveLength(7)
  })

  it('marks describe as current and everything else as ahead', () => {
    const steps = Array.from(container.querySelectorAll('[data-testid="compass-step"]'))
    expect(steps[0].getAttribute('data-state')).toBe('current')
    expect(steps.slice(1).every((s) => s.getAttribute('data-state') === 'ahead')).toBe(true)
  })

  it('names the next commitment in the AHEAD strip, not just the next step', () => {
    const ahead = container.querySelector('[data-testid="ahead"]')?.textContent ?? ''
    expect(ahead).toContain('only questions that change the plan')
  })

  it('shows the no-surprises contract on the first screen', () => {
    const contract = container.querySelector('[data-testid="contract"]')?.textContent ?? ''
    expect(contract).toContain('Every question that changes the plan')
    expect(contract).toContain('before you invest')
    expect(contract).toContain('lock')
  })

  it('refuses to start on a too-short description', () => {
    expect(button('start scaffolding').disabled).toBe(true)
    typeInto(textarea(), 'a portal')
    expect(button('start scaffolding').disabled).toBe(true)
  })

  it('starts once the description is substantial, advancing the compass', () => {
    typeInto(textarea(), 'A private portal where clients review and approve deliverables.')
    click(button('start scaffolding'))
    const steps = Array.from(container.querySelectorAll('[data-testid="compass-step"]'))
    expect(steps[0].getAttribute('data-state')).toBe('done')
    expect(steps[1].getAttribute('data-state')).toBe('current')
  })

  it('fills the description from the example button', () => {
    click(button('see an example'))
    expect(textarea().value.length).toBeGreaterThan(40)
  })

  it('lands on Clarify with a real question and its reasoning', async () => {
    typeInto(textarea(), 'A private portal where clients review and approve deliverables.')
    click(button('start scaffolding'))
    await act(async () => {})
    expect(container.querySelector('[data-testid="screen-clarify"]')).toBeTruthy()
    const q = container.querySelector('[data-testid="question"]')?.textContent ?? ''
    expect(q).toContain('Why I’m asking')
    expect(container.querySelectorAll('[data-testid="option"]').length).toBeGreaterThanOrEqual(2)
  })

  it('records an answer with what it shaped, then asks the next question', async () => {
    typeInto(textarea(), 'A private portal where clients review and approve deliverables.')
    click(button('start scaffolding'))
    await act(async () => {})
    click(container.querySelectorAll('[data-testid="option"]')[0])
    await act(async () => {})
    const answered = container.querySelector('[data-testid="answered"]')?.textContent ?? ''
    expect(answered).toContain('shaped:')
    expect(container.querySelector('[data-testid="question"]')).toBeTruthy()
  })

  it('opens the copilot with advice once a project exists', async () => {
    expect(container.querySelector('[data-testid="copilot"]')).toBeNull()
    typeInto(textarea(), 'A private portal where clients review and approve deliverables.')
    click(button('start scaffolding'))
    await act(async () => {})
    expect(container.querySelector('[data-testid="copilot-body"]')?.textContent).toContain(
      'questions that would change',
    )
  })

  it('walks the whole flow to handoff without a key', async () => {
    typeInto(textarea(), 'A private portal where clients review and approve deliverables.')
    click(button('start scaffolding'))
    await act(async () => {})

    // Answer every clarifying question the built-in bank offers.
    for (let i = 0; i < 6; i++) {
      const opt = container.querySelectorAll('[data-testid="option"]')[0]
      if (!opt) break
      click(opt)
      await act(async () => {})
    }

    // Capability check → accept scope
    expect(container.querySelector('[data-testid="screen-capability"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="cap-out"]')).toBeTruthy()
    click(button('accept scope'))
    await act(async () => {})

    // Decisions → choose the first option of each
    expect(container.querySelector('[data-testid="screen-decisions"]')).toBeTruthy()
    const decisions = Array.from(container.querySelectorAll('[data-testid="decision"]'))
    for (const d of decisions) {
      click(d.querySelectorAll('[data-testid="decision-option"]')[0])
      await act(async () => {})
    }
    click(button('continue'))
    await act(async () => {})

    // Plan: every task maps to a section, so no orphan warning and lock is enabled
    expect(container.querySelector('[data-testid="screen-plan"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-testid="spec-section"]').length).toBeGreaterThan(2)
    expect(container.querySelector('[data-testid="orphan-warning"]')).toBeNull()
    expect(button('send to swarm').disabled).toBe(false)
    click(button('send to swarm'))
    await act(async () => {})

    // Build screen admits it is simulated
    expect(container.querySelector('[data-testid="screen-build"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="sim-banner"]')?.textContent).toContain(
      'no swarm attached',
    )
  })
})
