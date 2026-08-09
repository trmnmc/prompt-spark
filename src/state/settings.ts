/**
 * AI settings store — bring-your-own Anthropic API key, model choice, and the
 * AI-mode toggle. Persisted in localStorage; the key never leaves the browser
 * except in direct calls to the Anthropic API.
 */
import { useSyncExternalStore } from 'react'

export const SETTINGS_KEY = 'prompt-spark:settings:v1'

export const AI_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const
export type AiModel = (typeof AI_MODELS)[number]

export interface AiSettings {
  apiKey: string
  model: AiModel
  aiEnabled: boolean
}

const DEFAULTS: AiSettings = {
  apiKey: '',
  model: 'claude-opus-5',
  aiEnabled: false,
}

function normalize(raw: unknown): AiSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS }
  const r = raw as Record<string, unknown>
  return {
    apiKey: typeof r.apiKey === 'string' ? r.apiKey : DEFAULTS.apiKey,
    model: AI_MODELS.includes(r.model as AiModel) ? (r.model as AiModel) : DEFAULTS.model,
    aiEnabled: typeof r.aiEnabled === 'boolean' ? r.aiEnabled : DEFAULTS.aiEnabled,
  }
}

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw == null) return { ...DEFAULTS }
    return normalize(JSON.parse(raw))
  } catch {
    return { ...DEFAULTS }
  }
}

const listeners = new Set<() => void>()
let cachedSnapshot: AiSettings | null = null

function notify(): void {
  cachedSnapshot = null
  for (const fn of listeners) fn()
}

export function saveSettings(patch: Partial<AiSettings>): AiSettings {
  const next = normalize({ ...loadSettings(), ...patch })
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  notify()
  return next
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot(): AiSettings {
  if (cachedSnapshot === null) cachedSnapshot = loadSettings()
  return cachedSnapshot
}

/** True when AI mode is on and a key is present — the "call Claude" gate. */
export function aiReady(s: AiSettings): boolean {
  return s.aiEnabled && s.apiKey.trim() !== ''
}

export function useSettings(): AiSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
