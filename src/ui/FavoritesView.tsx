import { useState, type CSSProperties } from 'react'

import type { Difficulty, Subject } from '../core/types'
import { favId, removeFavorite, useFavorites } from '../state/favorites'

/**
 * Display labels for legacy prompt favorites. These lived in PromptCard until
 * the interview board replaced the generator surface; saved prompts from
 * before that change still render here, so the labels outlive the card.
 */
const SUBJECT_LABELS: Record<Subject, string> = {
  realEstate: 'Real Estate',
  law: 'Law',
  finance: 'Finance',
  science: 'Science',
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

/** Inline line-clamp so long prompt/scout text truncates visually without editing app.css. */
const clampStyle: CSSProperties = {
  margin: 0,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
}

/**
 * Favorites view: renders every saved prompt/scout item as a .fav-item
 * card with Copy + Remove actions, or the empty state when the list is
 * bare. Saves/removals from anywhere in the app — and a fresh page
 * reload — are reflected here automatically.
 */
export default function FavoritesView() {
  // Uses the shared hook again: the useSyncExternalStore snapshot-stability
  // bug it used to work around (KI-1) was fixed in cycle 8, so the local
  // subscription this component carried is no longer needed.
  const favorites = useFavorites()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)

  async function handleCopy(id: string, text: string) {
    // Guard: navigator.clipboard is undefined in some contexts (insecure
    // origins, older browsers, test environments). Either the API being
    // absent or the write itself rejecting (permissions, unsupported,
    // denied) is a real failure — surface it instead of silently
    // pretending the copy succeeded.
    const clipboard = navigator.clipboard
    let failed = false
    if (!clipboard?.writeText) {
      failed = true
    } else {
      try {
        await clipboard.writeText(text)
      } catch {
        failed = true
      }
    }

    if (failed) {
      setFailedId(id)
      window.setTimeout(() => {
        setFailedId((current) => (current === id ? null : current))
      }, 1500)
    } else {
      setCopiedId(id)
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current))
      }, 1500)
    }
  }

  function handleRemove(id: string) {
    // Store guarantees first-match removal; passing the exact favId(f)
    // for this card means exactly this one entry is deleted.
    removeFavorite(id)
  }

  if (favorites.length === 0) {
    return (
      <section className="favorites-view">
        <h2>Favorites</h2>
        <div className="empty-state">No favorites yet</div>
        <p className="scout-note">Spark something and hit Save.</p>
      </section>
    )
  }

  return (
    <section className="favorites-view">
      <h2>Favorites</h2>
      {favorites.map((f) => {
        const id = favId(f)
        const fullText = f.kind === 'prompt' ? f.prompt.text : f.text
        const isCopied = copiedId === id
        const isFailed = failedId === id

        return (
          <div className="fav-item" key={id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {f.kind === 'prompt' ? (
                <>
                  <p title={f.prompt.text} style={clampStyle}>
                    {f.prompt.text}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    <span className="tag-chip">{SUBJECT_LABELS[f.prompt.subject]}</span>
                    <span className="tag-chip">{DIFFICULTY_LABELS[f.prompt.difficulty]}</span>
                    <span className="tag-chip">{f.prompt.timeBand}</span>
                    <span className="serial-tag">No {f.prompt.serial}</span>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontWeight: 700 }}>{f.label}</p>
                  <p title={f.text} style={clampStyle}>
                    {f.text}
                  </p>
                </>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                flexShrink: 0,
              }}
            >
              <button type="button" className="action-btn" onClick={() => handleCopy(id, fullText)}>
                {isCopied ? 'Copied!' : isFailed ? 'Copy failed' : 'Copy'}
              </button>
              <button type="button" className="action-btn action-btn--danger" onClick={() => handleRemove(id)}>
                Remove
              </button>
            </div>
          </div>
        )
      })}
    </section>
  )
}
