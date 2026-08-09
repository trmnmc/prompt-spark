import { useEffect, useState } from 'react'

import { expand } from '../core/brainScout'
import type { ScoutResult } from '../core/types'
import { addFavorite, favId, loadFavorites, removeFavorite } from '../state/favorites'

export interface BrainScoutViewProps {
  /** Lifted to App so a tab switch away and back doesn't wipe the ladder. */
  phrase: string
  onPhraseChange: (phrase: string) => void
  result: ScoutResult | null
  onResultChange: (result: ScoutResult) => void
}

/** Randomness lives only at this UI boundary — expand() itself is pure. */
function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

interface ScoutCardProps {
  className: string
  label: string
  text: string
  id: string
}

/**
 * One ladder-rung or remix card: a label chip, the expanded text, and
 * Copy/Save actions — mirrors PromptCard's clipboard-guard + favorites
 * pattern, scoped to a single scout item.
 */
function ScoutCard({ className, label, text, id }: ScoutCardProps) {
  const [copied, setCopied] = useState(false)
  // Ids are deliberately seed-independent (same phrase+label always hashes
  // to the same id — see brainScout.ts), so a Re-scout draw can change
  // `text` while `id` (and therefore this card's React key) stays put. A
  // plain useState initializer would only run once at mount and go stale
  // the moment Re-scout swaps in new text under the same id/key, so the
  // saved flag is recomputed from the store whenever the displayed text
  // (or id) changes, not just on mount.
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSaved(loadFavorites().some((f) => favId(f) === id && f.kind === 'scout' && f.text === text))
  }, [id, text])

  async function handleCopy() {
    // navigator.clipboard is undefined in jsdom / some embedded contexts —
    // guard it rather than assume it exists.
    const clipboard = navigator.clipboard
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(text)
      } catch {
        // Write can fail (permissions, unsupported); still surface feedback.
      }
    }
    setCopied(true)
  }

  function handleSave() {
    const added = addFavorite({ kind: 'scout', label, text, id })
    // addFavorite() no-ops (returns false) when a favorite with this id
    // already exists — which, because ids are seed-independent, can be a
    // STALE entry saved under a previous Re-scout draw's text. Replace it
    // so the text actually on screen is what ends up persisted, instead
    // of silently keeping the old wording.
    if (!added) {
      removeFavorite(id)
      addFavorite({ kind: 'scout', label, text, id })
    }
    setSaved(true)
  }

  return (
    <div className={className}>
      <span className="tag-chip">{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0 }}>{text}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <button type="button" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button type="button" onClick={handleSave}>
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Brain Scout view: a seed-phrase input feeds expand() to render the
 * 4-rung ladder (Weekend/Week/Month/Moonshot) plus 3 lens remixes, each
 * with its own Copy/Save controls persisted through the shared
 * favorites store. Re-scout re-rolls the seed for fresh phrasings while
 * keeping the same seed phrase.
 */
export default function BrainScoutView({ phrase, onPhraseChange, result, onResultChange }: BrainScoutViewProps) {
  const trimmed = phrase.trim()

  function handleSubmit() {
    if (trimmed === '') return
    onResultChange(expand(phrase, randomSeed()))
  }

  function handleRescout() {
    if (!result) return
    onResultChange(expand(result.seedPhrase, randomSeed()))
  }

  return (
    <section className="scout-view">
      <h2>Brain Scout</h2>
      <form
        className="scout-input-row"
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <input
          type="text"
          placeholder="Type a seed idea…"
          aria-label="Seed idea"
          value={phrase}
          onChange={(e) => onPhraseChange(e.target.value)}
        />
        <button type="submit" disabled={trimmed === ''}>
          Scout it 🔭
        </button>
      </form>

      {result ? (
        <>
          <button type="button" onClick={handleRescout} style={{ alignSelf: 'flex-start' }}>
            Re-scout
          </button>
          {result.rungs.map((r) => (
            <ScoutCard key={r.id} className="ladder-rung" label={r.rung} text={r.text} id={r.id} />
          ))}
          {result.remixes.map((r) => (
            <ScoutCard key={r.id} className="remix-card" label={r.lens} text={r.text} id={r.id} />
          ))}
        </>
      ) : (
        <p className="scout-note">Type a seed idea above to get your ladder + remixes.</p>
      )}
    </section>
  )
}
