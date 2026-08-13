import { beforeEach, describe, expect, it } from 'vitest'

import { createBrief } from '../core/brief'
import { BRIEF_KEY, clearBrief, loadBrief, saveBrief, subscribe } from './briefStore'

const T0 = 1_700_000_000_000

describe('briefStore', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when nothing is stored', () => {
    expect(loadBrief()).toBeNull()
  })

  it('round-trips a brief', () => {
    const b = createBrief('a fridge app', T0)
    saveBrief(b)
    expect(loadBrief()).toEqual(b)
  })

  it('returns null for invalid JSON', () => {
    localStorage.setItem(BRIEF_KEY, '{not json')
    expect(loadBrief()).toBeNull()
  })

  it('returns null for a payload missing the blocks array', () => {
    localStorage.setItem(BRIEF_KEY, JSON.stringify({ id: 'x', seedIdea: 'y' }))
    expect(loadBrief()).toBeNull()
  })

  it('clears the stored brief', () => {
    saveBrief(createBrief('x', T0))
    clearBrief()
    expect(loadBrief()).toBeNull()
  })

  it('notifies subscribers on save and clear', () => {
    let calls = 0
    const unsub = subscribe(() => calls++)
    saveBrief(createBrief('x', T0))
    clearBrief()
    unsub()
    saveBrief(createBrief('y', T0))
    expect(calls).toBe(2)
  })
})
