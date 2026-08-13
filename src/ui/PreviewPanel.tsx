import type { Guess } from '../core/interview'

interface Props {
  polished: string
  /** null = sketch unavailable (degraded); prompt-only preview. */
  outcome: string | null
  guesses: Guess[]
  note: string | null
  onCopy: () => void
  onBack: () => void
  onPin: (g: Guess) => void
  copied: boolean
}

/**
 * The preview gate: what you're about to copy, stacked on what it would
 * build. Copy lives HERE and nowhere else — approving the preview and
 * copying are the same act, and the copied text is exactly the text shown.
 */
export default function PreviewPanel({
  polished,
  outcome,
  guesses,
  note,
  onCopy,
  onBack,
  onPin,
  copied,
}: Props) {
  return (
    <section className="preview-panel" data-testid="preview">
      {note && <p className="ai-note">{note}</p>}

      <div className="draft-panel">
        <span className="label">Your prompt</span>
        <p className="draft" data-testid="preview-prompt">
          {polished}
        </p>
      </div>

      {outcome !== null && (
        <div className="outcome-panel">
          <span className="label">What you'd get</span>
          <p className="draft" data-testid="preview-outcome">
            {outcome}
          </p>
        </div>
      )}

      {guesses.length > 0 && (
        <div className="guess-row">
          <span className="label">The sketch had to guess — pin these down?</span>
          <div className="guess-chips">
            {guesses.map((g) => (
              <button
                key={g.id}
                type="button"
                className="action-btn guess-chip"
                data-testid="guess-chip"
                onClick={() => onPin(g)}
              >
                {g.topic}: {g.assumption}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="preview-actions">
        <button type="button" className="action-btn finish-btn" onClick={onCopy}>
          {copied ? 'Copied!' : 'Looks right — Copy'}
        </button>
        <button type="button" className="action-btn" onClick={onBack}>
          Back to the board
        </button>
      </div>
    </section>
  )
}
