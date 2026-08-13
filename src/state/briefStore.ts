/**
 * Brief persistence — one in-progress interview, in localStorage.
 *
 * Follows src/state/favorites.ts: getSnapshot returns a CACHED reference that
 * changes only on a real write. Returning a fresh object each call makes React
 * conclude the store is perpetually changing and loop (see KI-1 in REPORT.md).
 * Note the separate `cacheValid` flag — null is a legitimate cached value here
 * (no brief stored), so it cannot double as the "cache empty" sentinel the way
 * it does in the favorites store.
 */
import { useSyncExternalStore } from 'react'

import type { Brief } from '../core/brief'

export const BRIEF_KEY = 'prompt-spark:brief:v1'

const listeners = new Set<() => void>()
let cachedSnapshot: Brief | null = null
let cacheValid = false

function notify(): void {
  cacheValid = false
  for (const fn of listeners) fn()
}

function isBrief(raw: unknown): raw is Brief {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.seedIdea === 'string' &&
    Array.isArray(r.blocks) &&
    typeof r.createdAt === 'number' &&
    typeof r.updatedAt === 'number'
  )
}

export function loadBrief(): Brief | null {
  try {
    const raw = localStorage.getItem(BRIEF_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isBrief(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveBrief(brief: Brief): void {
  localStorage.setItem(BRIEF_KEY, JSON.stringify(brief))
  notify()
}

export function clearBrief(): void {
  localStorage.removeItem(BRIEF_KEY)
  notify()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function getSnapshot(): Brief | null {
  if (!cacheValid) {
    cachedSnapshot = loadBrief()
    cacheValid = true
  }
  return cachedSnapshot
}

export function useBrief(): Brief | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
