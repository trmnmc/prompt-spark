import { useState } from 'react'

import type { Answer, Question } from '../../core/northstar'

interface Props {
  answers: Answer[]
  question: Question | null
  busy: boolean
  onAnswer: (answer: string) => void
}

/**
 * Step 2. The design's promise is that every question here changes the plan —
 * so each answered one keeps its SHAPED tag on screen as evidence, and the
 * "why I'm asking" line is mandatory rather than decorative.
 */
export default function ClarifyScreen({ answers, question, busy, onAnswer }: Props) {
  const [typed, setTyped] = useState('')
  const num = answers.length + 1

  return (
    <div data-testid="screen-clarify">
      <div className="ns-label">
        Step 2 · {question ? `Question ${num}` : 'Questions complete'}
      </div>
      <h1 className="ns-h">
        {question ? question.question : 'No more questions — everything else I can default.'}
      </h1>
      <p className="ns-sub">
        Each one changes the plan. Anything I don&rsquo;t ask, I default sensibly — and show you at
        plan review.
      </p>

      {answers.length > 0 && (
        <ul className="ns-answered" data-testid="answered">
          {answers.map((a) => (
            <li key={a.id} className="ns-answered-row">
              <span className="ns-tick">✓</span>
              <span className="ns-answered-q">{a.question}</span>
              <span className="ns-answered-a">{a.answer}</span>
              <span className="ns-shaped">shaped: {a.shaped}</span>
            </li>
          ))}
        </ul>
      )}

      {question && (
        <div className="ns-card" data-testid="question">
          <p className="ns-why">
            <strong>Why I&rsquo;m asking:</strong> {question.why}
          </p>
          <div className="ns-options">
            {question.options.map((o) => (
              <button
                key={o}
                type="button"
                className="ns-option"
                data-testid="option"
                disabled={busy}
                onClick={() => onAnswer(o)}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="ns-freetext">
            <input
              className="ns-input"
              aria-label="Type an answer"
              placeholder="Type an answer…"
              value={typed}
              disabled={busy}
              onChange={(e) => setTyped(e.target.value)}
            />
            <button
              type="button"
              className="ns-btn"
              disabled={busy || typed.trim() === ''}
              onClick={() => {
                onAnswer(typed.trim())
                setTyped('')
              }}
            >
              Answer
            </button>
          </div>
        </div>
      )}

      {busy && <p className="ns-sub" style={{ marginTop: 14 }}>Thinking about what to ask next…</p>}
    </div>
  )
}
