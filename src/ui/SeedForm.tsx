import { useState } from 'react'

interface Props {
  onStart: (idea: string) => void
  /** Returns a cold-start idea — the surviving role of the template packs. */
  onSurprise: () => string
}

export default function SeedForm({ onStart, onSurprise }: Props) {
  const [idea, setIdea] = useState('')

  return (
    <section className="seed-form">
      <label className="seed-label" htmlFor="seed-idea">
        Your rough idea
      </label>
      <input
        id="seed-idea"
        className="block-input seed-input"
        value={idea}
        placeholder="an app that helps me use up leftovers"
        onChange={(e) => setIdea(e.target.value)}
      />
      <div className="seed-actions">
        <button
          type="button"
          className="action-btn"
          disabled={idea.trim() === ''}
          onClick={() => onStart(idea.trim())}
        >
          Start
        </button>
        <button type="button" className="action-btn" onClick={() => setIdea(onSurprise())}>
          Surprise me
        </button>
      </div>
    </section>
  )
}
