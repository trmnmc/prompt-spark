import { useEffect, useMemo, useState } from 'react'

import { generate } from '../core/generate'
import { decodeShare, encodeShare } from '../core/share'
import type { Filters, ScoutResult } from '../core/types'
import '../styles/app.css'
import FilterBar from './FilterBar'
import PromptCard from './PromptCard'
import SurpriseHero from './SurpriseHero'
import BrainScoutView from './BrainScoutView'
import FavoritesView from './FavoritesView'

type View = 'generator' | 'scout' | 'favorites'

const TABS: { value: View; label: string }[] = [
  { value: 'generator', label: 'Generator' },
  { value: 'scout', label: 'Brain Scout' },
  { value: 'favorites', label: 'Favorites' },
]

export default function App() {
  // Bootstrap from a share link on first mount: a valid ?seed=&subject=
  // etc. query string reproduces the exact shared prompt (generate() is
  // memoized on seed+filters, so decoding the same pair renders a
  // string-identical result). Absent/invalid query -> normal empty state.
  const [seed, setSeed] = useState<number | null>(() => decodeShare(window.location.search)?.seed ?? null)
  const [filters, setFilters] = useState<Filters>(() => decodeShare(window.location.search)?.filters ?? {})
  const [view, setView] = useState<View>('generator')
  const [linkCopied, setLinkCopied] = useState(false)

  // Lifted out of BrainScoutView so switching tabs and back doesn't wipe
  // the scouted ladder — mirrors how seed/filters survive here already.
  const [scoutPhrase, setScoutPhrase] = useState('')
  const [scoutResult, setScoutResult] = useState<ScoutResult | null>(null)

  // Pure downstream of seed + filters — generate() itself never touches
  // Math.random; randomness lives only at the UI boundary below.
  const prompt = useMemo(() => (seed == null ? undefined : generate(seed, filters)), [seed, filters])

  // Keep the address bar in sync with what's actually on screen. Without
  // this, the URL stays pinned to whatever seed it loaded with (e.g. a
  // share link) even after Surprise me / filter changes swap in a new
  // prompt, so copying the address bar shares a prompt the user isn't
  // looking at, and a reload discards the current prompt and silently
  // re-renders the stale one. replaceState (not push) so every spark/
  // filter tweak doesn't spam browser history.
  useEffect(() => {
    if (seed == null) return
    const qs = encodeShare({ seed, filters })
    const url = `${window.location.pathname}?${qs}${window.location.hash}`
    window.history.replaceState(null, '', url)
  }, [seed, filters])

  function handleSpark() {
    // Randomness lives here, at the UI boundary — everything downstream
    // (generate(), expand()) is a pure function of the seed it's given.
    setSeed(Math.floor(Math.random() * 2 ** 31))
    setLinkCopied(false)
  }

  async function handleCopyShareLink() {
    if (seed == null) return
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
      </header>

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
            <SurpriseHero onSpark={handleSpark} />
            <FilterBar filters={filters} onChange={setFilters} />
            <PromptCard prompt={prompt} />
            {prompt && (
              <div className="share-link-row">
                <button type="button" className="share-link-button" onClick={handleCopyShareLink}>
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
            onResultChange={setScoutResult}
          />
        )}
        {view === 'favorites' && <FavoritesView />}
      </main>
    </div>
  )
}
