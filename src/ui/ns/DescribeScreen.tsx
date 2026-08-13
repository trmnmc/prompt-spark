import { useState } from 'react'

interface Props {
  onStart: (description: string) => void
  busy: boolean
}

const EXAMPLE =
  "A private portal where my design studio's clients can view work in progress, " +
  'leave comments, and approve deliverables. Should feel calm — not like a ticketing tool.'

/**
 * Step 1. Outcomes, not tech — proposing the tech is Northstar's job, and
 * saying so up front is what stops people writing a stack list instead of
 * a description.
 */
export default function DescribeScreen({ onStart, busy }: Props) {
  const [text, setText] = useState('')
  const ready = text.trim().length > 12

  return (
    <div data-testid="screen-describe">
      <div className="ns-label">Step 1 · Describe</div>
      <h1 className="ns-h">What are we building?</h1>
      <p className="ns-sub">
        Plain words are fine. Outcomes, not tech — proposing the tech is my job.
      </p>

      <textarea
        className="ns-textarea"
        aria-label="Project description"
        placeholder={EXAMPLE}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="ns-chips">
        <span className="ns-chip">Web app</span>
        <span className="ns-chip">Client-facing</span>
        <span className="ns-chip">~50 users</span>
      </div>

      <section className="ns-contract" data-testid="contract">
        <div className="ns-label">The no-surprises contract</div>
        <ol>
          <li>Every question that changes the plan — nothing more.</li>
          <li>What&rsquo;s possible, what needs setup, what&rsquo;s out of scope — before you invest.</li>
          <li>A full plan you lock. The swarm builds exactly that.</li>
        </ol>
      </section>

      <div className="ns-actions">
        <button
          type="button"
          className="ns-btn ns-btn--primary"
          disabled={!ready || busy}
          onClick={() => onStart(text.trim())}
        >
          {busy ? 'Reading your description…' : 'Start scaffolding →'}
        </button>
        <button
          type="button"
          className="ns-btn"
          disabled={busy}
          onClick={() => setText(EXAMPLE)}
        >
          See an example
        </button>
      </div>
    </div>
  )
}
