import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it } from 'vitest'

import { FAVORITES_KEY, type Favorite, type GeneratedPrompt } from '../core/types'
import { addFavorite, favId, loadFavorites, removeFavorite, useFavorites } from './favorites'

// Tells React this environment intentionally drives updates via act()
// (only the useFavorites mount/update tests below use it); without
// this, React logs a spurious "not configured to support act(...)"
// warning even though act() is used correctly.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function makePrompt(id: string): GeneratedPrompt {
  return {
    id,
    text: `Do something for ${id}`,
    subject: 'law',
    difficulty: 'medium',
    timeBand: 'an evening or two (3–6 hours)',
    seed: 42,
    templateId: 'tmpl-1',
    serial: id.toUpperCase().slice(0, 4),
  }
}

function promptFavorite(id: string): Favorite {
  return { kind: 'prompt', prompt: makePrompt(id) }
}

function scoutFavorite(id: string): Favorite {
  return { kind: 'scout', label: `Rung for ${id}`, text: `Scout text ${id}`, id }
}

beforeEach(() => {
  localStorage.clear()
})

describe('favId', () => {
  it('uses prompt.id for kind:prompt favorites', () => {
    const f = promptFavorite('abc123')
    expect(favId(f)).toBe('abc123')
  })

  it('uses id for kind:scout favorites', () => {
    const f = scoutFavorite('xyz789')
    expect(favId(f)).toBe('xyz789')
  })
})

describe('loadFavorites', () => {
  it('returns [] when localStorage has no key set', () => {
    expect(loadFavorites()).toEqual([])
  })

  it('returns [] when the stored value is corrupt JSON', () => {
    localStorage.setItem(FAVORITES_KEY, '{not valid json')
    expect(loadFavorites()).toEqual([])
  })

  it('returns [] when the stored value is valid JSON but not an array', () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify({ oops: true }))
    expect(loadFavorites()).toEqual([])
  })
})

describe('addFavorite', () => {
  it('adds a new favorite so it appears in loadFavorites()', () => {
    const f = promptFavorite('p1')
    const added = addFavorite(f)
    expect(added).toBe(true)
    expect(loadFavorites()).toEqual([f])
  })

  it('is a no-op (returns false, length unchanged) when adding a duplicate id', () => {
    const f = promptFavorite('p1')
    addFavorite(f)
    const added = addFavorite(promptFavorite('p1'))
    expect(added).toBe(false)
    expect(loadFavorites()).toHaveLength(1)
  })

  it('dedupes scout favorites by id the same way', () => {
    const f = scoutFavorite('s1')
    addFavorite(f)
    const added = addFavorite(scoutFavorite('s1'))
    expect(added).toBe(false)
    expect(loadFavorites()).toHaveLength(1)
  })

  it('allows distinct ids to accumulate', () => {
    addFavorite(promptFavorite('p1'))
    addFavorite(promptFavorite('p2'))
    addFavorite(scoutFavorite('s1'))
    expect(loadFavorites()).toHaveLength(3)
  })
})

describe('removeFavorite', () => {
  it('deletes exactly one matching entry', () => {
    addFavorite(promptFavorite('p1'))
    addFavorite(promptFavorite('p2'))
    const removed = removeFavorite('p1')
    expect(removed).toBe(true)
    const remaining = loadFavorites()
    expect(remaining).toHaveLength(1)
    expect(favId(remaining[0])).toBe('p2')
  })

  it('returns false on a second remove of the same id', () => {
    addFavorite(promptFavorite('p1'))
    expect(removeFavorite('p1')).toBe(true)
    expect(removeFavorite('p1')).toBe(false)
    expect(loadFavorites()).toEqual([])
  })

  it('returns false when removing an id that was never added', () => {
    expect(removeFavorite('nope')).toBe(false)
  })

  it('removes only the first match when duplicate ids somehow coexist', () => {
    // Directly seed storage with a duplicate-id pair to test "exactly one"
    // deletion semantics even in a state addFavorite would never produce.
    const dupA = promptFavorite('dup')
    const dupB = promptFavorite('dup')
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([dupA, dupB]))
    const removed = removeFavorite('dup')
    expect(removed).toBe(true)
    expect(loadFavorites()).toHaveLength(1)
  })
})

describe('persistence across simulated reload', () => {
  it('a fresh loadFavorites() call after writes returns the same list', () => {
    addFavorite(promptFavorite('p1'))
    addFavorite(scoutFavorite('s1'))
    const before = loadFavorites()

    // Simulate a reload: nothing but localStorage survives, so a brand
    // new loadFavorites() call must reconstruct the identical list.
    const after = loadFavorites()

    expect(after).toEqual(before)
    expect(after).toEqual([promptFavorite('p1'), scoutFavorite('s1')])
  })

  it('persists under the frozen FAVORITES_KEY', () => {
    addFavorite(promptFavorite('p1'))
    const raw = localStorage.getItem(FAVORITES_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toEqual([promptFavorite('p1')])
  })
})

describe('useFavorites (mount + store-change updates)', () => {
  // KI-1 regression: on the broken implementation, useFavorites() used
  // loadFavorites (a fresh-array-per-call reader) directly as
  // useSyncExternalStore's getSnapshot, violating its "same reference
  // until data changes" contract. React responds by tearing down the
  // mount with "Maximum update depth exceeded" — so this test fails on
  // the pre-fix code and passes once getSnapshot returns a cached,
  // stable reference.
  it('mounts without error, reflects the store, and re-renders exactly once per store change', () => {
    let renderCount = 0
    function FavoritesCount() {
      const favorites = useFavorites()
      renderCount += 1
      return createElement('div', null, `count:${favorites.length}`)
    }

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      act(() => {
        root.render(createElement(FavoritesCount))
      })

      expect(container.textContent).toBe('count:0')
      expect(renderCount).toBe(1)

      act(() => {
        addFavorite(promptFavorite('mount-1'))
      })

      expect(container.textContent).toBe('count:1')
      expect(renderCount).toBe(2)

      act(() => {
        addFavorite(promptFavorite('mount-2'))
      })

      expect(container.textContent).toBe('count:2')
      expect(renderCount).toBe(3)
    } finally {
      act(() => {
        root.unmount()
      })
      container.remove()
    }
  })

  it('getSnapshot returns the same reference across reads with no writes between them', () => {
    const snapshots: Favorite[][] = []
    function Capture({ tick: _tick }: { tick: number }): null {
      snapshots.push(useFavorites())
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      // Re-render (via a changed prop) without any store write in
      // between: a stable getSnapshot must hand back the identical
      // array reference both times.
      act(() => {
        root.render(createElement(Capture, { tick: 0 }))
      })
      act(() => {
        root.render(createElement(Capture, { tick: 1 }))
      })

      expect(snapshots).toHaveLength(2)
      expect(snapshots[0]).toBe(snapshots[1])

      // After a real write, the cache must invalidate: a fresh, distinct
      // reference (with the new data) must be handed out.
      act(() => {
        addFavorite(promptFavorite('stability-1'))
      })

      expect(snapshots).toHaveLength(3)
      expect(snapshots[2]).not.toBe(snapshots[1])
      expect(snapshots[2]).toHaveLength(1)
    } finally {
      act(() => {
        root.unmount()
      })
    }
  })
})
