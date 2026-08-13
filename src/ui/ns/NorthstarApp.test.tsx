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

  it('is honest that later screens are not built yet', () => {
    typeInto(textarea(), 'A private portal where clients review and approve deliverables.')
    click(button('start scaffolding'))
    expect(container.querySelector('[data-testid="not-built"]')).toBeTruthy()
    expect(container.textContent).toContain('A private portal where clients review')
  })

  it('opens the copilot with advice once a project exists', () => {
    expect(container.querySelector('[data-testid="copilot"]')).toBeNull()
    typeInto(textarea(), 'A private portal where clients review and approve deliverables.')
    click(button('start scaffolding'))
    expect(container.querySelector('[data-testid="copilot-body"]')?.textContent).toContain(
      'questions that would change',
    )
  })
})
