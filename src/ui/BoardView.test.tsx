import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addBlock, createBrief, type Brief, type Proposal } from '../core/brief'
import { renderDraft } from '../core/render'
import BoardView from './BoardView'

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

const T0 = 1_700_000_000_000

function briefWithTwo(): Brief {
  let b = createBrief('a fridge app', T0)
  b = addBlock(
    b,
    {
      kind: 'intent',
      label: 'Intent',
      question: 'q',
      answer: 'a fridge tool',
      sentence: 'Build a fridge tool.',
    },
    T0,
  )
  b = addBlock(
    b,
    {
      kind: 'whoFor',
      label: 'Who For',
      question: 'q',
      answer: 'just me',
      sentence: "It's for just me.",
    },
    T0,
  )
  return b
}

const noop = () => {}

function mount(overrides: Partial<Parameters<typeof BoardView>[0]> = {}) {
  const brief = overrides.brief ?? briefWithTwo()
  const props = {
    brief,
    draft: renderDraft(brief),
    proposal: null as Proposal | null,
    loading: false,
    note: null as string | null,
    onAccept: noop as (o: string) => void,
    onAddOwn: noop as (l: string, a: string) => void,
    onEdit: noop as (id: string, a: string) => void,
    onRemove: noop as (id: string) => void,
    onMove: noop as (id: string, i: number) => void,
    onFinish: noop,
    ...overrides,
  }
  act(() => {
    root = createRoot(container)
    root.render(<BoardView {...props} />)
  })
  return brief
}

function rows(): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-testid="block-row"]'))
}

function button(scope: ParentNode, label: string): HTMLButtonElement {
  const found = Array.from(scope.querySelectorAll('button')).find((b) =>
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

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('BoardView', () => {
  it('renders one row per placed block', () => {
    mount()
    expect(rows()).toHaveLength(2)
  })

  it('shows the growing draft', () => {
    mount()
    expect(container.querySelector('[data-testid="draft"]')?.textContent).toBe(
      "Build a fridge tool. It's for just me.",
    )
  })

  it('renders the staged proposal with its options', () => {
    mount({
      proposal: {
        kind: 'inputs',
        label: 'Inputs',
        question: 'What does it know?',
        options: ['I tell it', 'A list'],
      },
    })
    expect(container.textContent).toContain('What does it know?')
    expect(button(container, 'I tell it')).toBeTruthy()
  })

  it('calls onAccept with the chosen option', () => {
    const onAccept = vi.fn()
    mount({
      onAccept,
      proposal: { kind: 'inputs', label: 'Inputs', question: 'Q?', options: ['first', 'second'] },
    })
    click(button(container, 'second'))
    expect(onAccept).toHaveBeenCalledWith('second')
  })

  it('calls onRemove with the block id', () => {
    const onRemove = vi.fn()
    const brief = mount({ onRemove })
    click(button(rows()[0], 'remove'))
    expect(onRemove).toHaveBeenCalledWith(brief.blocks[0].id)
  })

  it('edits a block answer in place', () => {
    const onEdit = vi.fn()
    const brief = mount({ onEdit })
    click(button(rows()[0], 'edit'))
    const input = rows()[0].querySelector('input')
    expect(input).toBeTruthy()
    type(input as HTMLInputElement, 'a better tool')
    click(button(rows()[0], 'save'))
    expect(onEdit).toHaveBeenCalledWith(brief.blocks[0].id, 'a better tool')
  })

  it('moves a block down', () => {
    const onMove = vi.fn()
    const brief = mount({ onMove })
    click(button(rows()[0], 'move down'))
    expect(onMove).toHaveBeenCalledWith(brief.blocks[0].id, 1)
  })

  it('adds a user block with its own label', () => {
    const onAddOwn = vi.fn()
    mount({ onAddOwn })
    click(button(container, 'add a block'))
    const inputs = container.querySelectorAll<HTMLInputElement>('.add-block input')
    type(inputs[0], 'Budget')
    type(inputs[1], 'under $10 a month')
    click(button(container.querySelector('.add-block') as ParentNode, 'add'))
    expect(onAddOwn).toHaveBeenCalledWith('Budget', 'under $10 a month')
  })

  it('surfaces a note without hiding the board', () => {
    mount({ note: 'Rate limited.' })
    expect(container.textContent).toContain('Rate limited.')
    expect(rows()).toHaveLength(2)
  })

  it('disables the option buttons while loading', () => {
    mount({
      loading: true,
      proposal: { kind: 'inputs', label: 'Inputs', question: 'Q?', options: ['alpha', 'beta'] },
    })
    expect(button(container, 'alpha').disabled).toBe(true)
  })
})
