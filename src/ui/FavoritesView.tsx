import { useEffect, useState, type CSSProperties } from 'react'

import type { Favorite } from '../core/types'
import { favId, loadFavorites, removeFavorite, subscribe } from '../state/favorites'
import { DIFFICULTY_LABELS, SUBJECT_LABELS } from './PromptCard'

/** Inline line-clamp so long prompt/scout text truncates visually without editing app.css. */
const clampStyle: CSSProperties = {
  margin: 0,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
}

/**
 * Subscribes to the favorites store via the same primitives useFavorites()
 * wraps (loadFavorites + subscribe), but keeps the snapshot in local
 * component state instead of going through useSyncExternalStore — whose
 * contract useFavorites() currently violates (loadFavorites() returns a
 * fresh array reference on every call, which useSyncExternalStore reads
 * as "always changed" and spins into an infinite re-render loop the
 * instant it's mounted, even with zero favorites). That's a store-layer
 * bug outside this file's scope; this local subscription reads the same
 * live data — including across a page reload, since loadFavorites()
 * hits localStorage fresh both on mount and on every notify() — without
 * tripping it.
 */
function useLocalFavorites(): Favorite[] {
  const [snapshot, setSnapshot] = useState<Favorite[]>(() => loadFavorites())

  useEffect(() => {
    const sync = () => setSnapshot(loadFavorites())
    sync()
    return subscribe(sync)
  }, [])

  return snapshot
}

/**
 * Favorites view: renders every saved prompt/scout item as a .fav-item
 * card with Copy + Remove actions, or the empty state when the list is
 * bare. Saves/removals from anywhere in the app — and a fresh page
 * reload — are reflected here automatically.
 */
export default function FavoritesView() {
  const favorites = useLocalFavorites()
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
