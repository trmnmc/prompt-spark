/**
 * Favorites store — framework-agnostic, backed by localStorage.
 *
 * Persists under FAVORITES_KEY as a JSON array of Favorite. Every write
 * is synchronous via localStorage.setItem(FAVORITES_KEY, JSON.stringify(list)).
 * Dedupe / removal is keyed by favId(f):
 *   - kind 'prompt' -> f.prompt.id
 *   - kind 'scout'  -> f.id
 */
import { useSyncExternalStore } from 'react'

import { FAVORITES_KEY, type Favorite } from '../core/types'

/** The dedupe/remove key for a Favorite. */
export function favId(f: Favorite): string {
  return f.kind === 'prompt' ? f.prompt.id : f.id
}

const listeners = new Set<() => void>()

function notify(): void {
  for (const fn of listeners) fn()
}

/**
 * Reads the current favorites list from localStorage. Tolerates a
 * missing key, invalid JSON, or a non-array payload by returning [].
 */
export function loadFavorites(): Favorite[] {
  const raw = localStorage.getItem(FAVORITES_KEY)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Favorite[]
  } catch {
    return []
  }
}

function persist(list: Favorite[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list))
}

/**
 * Adds a favorite if no entry with the same favId() already exists.
 * Returns true if it was added, false (no-op) if a duplicate was found.
 */
export function addFavorite(f: Favorite): boolean {
  const list = loadFavorites()
  const id = favId(f)
  if (list.some((existing) => favId(existing) === id)) return false
  persist([...list, f])
  notify()
  return true
}

/**
 * Removes exactly the first favorite matching id. Returns true if an
 * entry was removed, false if no entry matched.
 */
export function removeFavorite(id: string): boolean {
  const list = loadFavorites()
  const index = list.findIndex((existing) => favId(existing) === id)
  if (index === -1) return false
  const next = [...list.slice(0, index), ...list.slice(index + 1)]
  persist(next)
  notify()
  return true
}

/** Subscribe to change notifications; call the returned fn to unsubscribe. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** React hook returning the current favorites list, kept in sync via useSyncExternalStore. */
export function useFavorites(): Favorite[] {
  return useSyncExternalStore(subscribe, loadFavorites, loadFavorites)
}
