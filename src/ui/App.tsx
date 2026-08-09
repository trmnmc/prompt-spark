import { useEffect, useMemo, useRef, useState } from 'react'

import { aiGenerate, aiScout, AiError } from '../core/ai'
import { expand } from '../core/brainScout'
import { generate } from '../core/generate'
import { decodeShare, encodeShare } from '../core/share'
import type { Filters, GeneratedPrompt, ScoutResult } from '../core/types'
import { aiReady, useSettings } from '../state/settings'
import '../styles/app.css'
import FilterBar from './FilterBar'
import PromptCard from './PromptCard'
import SettingsPanel from './SettingsPanel'
import SurpriseHero from './SurpriseHero'
import BrainScoutView from './BrainScoutView'
import FavoritesView from './FavoritesView'

type View = 'generator' | 'scout' | 'favorites'

const TABS: { value: View; label: string }[] = [
  { value: 'generator', label: 'Generator' },
  { value: 'scout', label: 'Brain Scout' },
  { value: 'favorites', label: 'Favorites' },
]

/** Randomness lives only at this UI boundary — everything downstream is pure. */
function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

export default function App() {
  // Bootstrap from a share link on first mount: a valid ?seed=&subject=
  // etc. query string reproduces the exact shared prompt (generate() is
  // memoized on seed+filters, so decoding the same pair renders a
  // string-identical result). Absent/invalid query -> normal empty state.
  const [seed, setSeed] = useState<number | null>(() => decodeShare(window.location.search)?.seed ?? null)
  const [filters, setFiltersState] = useState<Filters>(() => decodeShare(window.location.search)?.filters ?? {})
  const [view, setView] = useState<View>('generator')
  const [linkCopied, setLinkCopied] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const settings = useSettings()

  // AI-mode generator state. When an AI prompt is present it wins over the
  // template prompt; template mode stays the always-working fallback.
  const [aiPrompt, setAiPrompt] = useState<GeneratedPrompt | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)
  // Ignore results from superseded sparks (rapid double-taps, settings flips).
  const sparkCounter = useRef(0)

  // Scout state lives HERE (not in BrainScoutView) so tab switches can't
  // unmount the in-flight bookkeeping: a stale promise resolving after an
  // unmount/remount must still lose to the current ticket (reviewer finding).
  const [scoutPhrase, setScoutPhrase] = useState('')
  const [scoutResult, setScoutResult] = useState<ScoutResult | null>(null)
  const [scoutLoading, setScoutLoading] = useState(false)
  const [scoutNote, setScoutNote] = useState<string | null>(null)
  const scoutCounter = useRef(0)

  // Flipping AI mode / key / model mid-flight invalidates every pending
  // call — a late result from the old configuration must not land.
  const aiConfig = `${settings.aiEnabled}|${settings.apiKey}|${settings.model}`
  useEffect(() => {
    sparkCounter.current++
    scoutCounter.current++
    setAiLoading(false)
    setScoutLoading(false)
  }, [aiConfig])

  // Pure downstream of seed + filters — generate() itself never touches
  // Math.random; randomness lives only at the UI boundary.
  const templatePrompt = useMemo(
    () => (seed == null ? undefined : generate(seed, filters)),
    [seed, filters],
  )
  const prompt = aiPrompt ?? templatePrompt

  // Changing filters invalidates a displayed AI prompt — its subject/
  // difficulty chips may contradict the newly active filter (reviewer
  // finding). Template mode regenerates from the memo automatically.
  function setFilters(next: Filters) {
    setFiltersState(next)
    if (aiPrompt != null) {
      sparkCounter.current++
      setAiPrompt(null)
      setAiNote(null)
      setAiLoading(false)
    }
  }

  // Keep the address bar in sync with what's actually on screen. AI prompts
  // aren't seed-reproducible, so while one is displayed the query string is
  // CLEARED — otherwise copying the address bar would share the previous
  // template prompt (reviewer finding).
  useEffect(() => {
    if (aiPrompt != null) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`)
      return
    }
    if (seed == null) return
    const qs = encodeShare({ seed, filters })
    const url = `${window.location.pathname}?${qs}${window.location.hash}`
    window.history.replaceState(null, '', url)
  }, [seed, filters, aiPrompt])

  function sparkTemplate() {
    setAiPrompt(null)
    setSeed(randomSeed())
    setLinkCopied(false)
  }

  async function handleSpark() {
    setAiNote(null)
    if (!aiReady(settings)) {
      sparkTemplate()
      return
    }
    const ticket = ++sparkCounter.current
    setAiLoading(true)
    try {
      const p = await aiGenerate(settings.apiKey, settings.model, filters)
      if (ticket !== sparkCounter.current) return
      setAiPrompt(p)
      setLinkCopied(false)
    } catch (e) {
      if (ticket !== sparkCounter.current) return
      const err = e instanceof AiError ? e : new AiError('Unexpected error.', true)
      setAiNote(
        err.recoverable ? `${err.message} Showing a template prompt instead.` : err.message,
      )
      if (err.recoverable) sparkTemplate()
    } finally {
      if (ticket === sparkCounter.current) setAiLoading(false)
    }
  }

  async function handleScout(rawPhrase: string) {
    // Trim before anything else: aiScout's verbatim-containment invariant
    // would near-deterministically fail on trailing whitespace (reviewer
    // finding), burning an API call for nothing.
    const seedPhrase = rawPhrase.trim()
    if (seedPhrase === '' || scoutLoading) return
    setScoutNote(null)
    if (!aiReady(settings)) {
      setScoutResult(expand(seedPhrase, randomSeed()))
      return
    }
    const ticket = ++scoutCounter.current
    setScoutLoading(true)
    try {
      const r = await aiScout(settings.apiKey, settings.model, seedPhrase)
      if (ticket !== scoutCounter.current) return
      setScoutResult(r)
    } catch (e) {
      if (ticket !== scoutCounter.current) return
      const err = e instanceof AiError ? e : new AiError('Unexpected error.', true)
      setScoutNote(
        err.recoverable ? `${err.message} Showing a template expansion instead.` : err.message,
      )
      if (err.recoverable) setScoutResult(expand(seedPhrase, randomSeed()))
    } finally {
      if (ticket === scoutCounter.current) setScoutLoading(false)
    }
  }

  async function handleCopyShareLink() {
    if (seed == null || aiPrompt != null) return
    const qs = encodeShare({ seed, filters })
    const url = `${window.location.origin}${window.location.pathname}?${qs}`
    const clipboard = navigator.clipboard
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(url)
      } catch {
        // Write can fail (permissions, unsupported); still surface feedback.
      }
    }
    setLinkCopied(true)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Prompt Spark</h1>
        <button
          type="button"
          className="action-btn settings-toggle"
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          {aiReady(settings) ? '⚙︎ AI on' : '⚙︎ AI'}
        </button>
      </header>

      {settingsOpen && <SettingsPanel />}

      <nav className="tab-bar" aria-label="Sections">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={view === value ? 'tab-button tab-button--active' : 'tab-button'}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {view === 'generator' && (
          <>
            <SurpriseHero onSpark={handleSpark} loading={aiLoading} />
            <FilterBar filters={filters} onChange={setFilters} />
            {aiNote && <p className="ai-note">{aiNote}</p>}
            <PromptCard prompt={prompt} />
            {prompt && aiPrompt == null && (
              <div className="share-link-row">
                <button type="button" className="share-link-button action-btn" onClick={handleCopyShareLink}>
                  {linkCopied ? 'Link copied!' : 'Copy share link \u{1F517}'}
                </button>
              </div>
            )}
          </>
        )}
        {view === 'scout' && (
          <BrainScoutView
            phrase={scoutPhrase}
            onPhraseChange={setScoutPhrase}
            result={scoutResult}
            loading={scoutLoading}
            note={scoutNote}
            onScout={handleScout}
          />
        )}
        {view === 'favorites' && <FavoritesView />}
      </main>
    </div>
  )
}
