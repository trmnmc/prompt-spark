import { useEffect, useState } from 'react'

import type { Difficulty, GeneratedPrompt, Subject } from '../core/types'
import { addFavorite, favId, loadFavorites } from '../state/favorites'

/** Display labels — mirrors FilterBar's subject chip labels. */
const SUBJECT_LABELS: Record<Subject, string> = {
  realEstate: 'Real Estate',
  law: 'Law',
  finance: 'Finance',
  science: 'Science',
}

/** Display labels — mirrors FilterBar's difficulty chip labels. */
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export interface PromptCardProps {
  prompt?: GeneratedPrompt
}

/**
 * Renders a fully resolved prompt: the generated text, subject +
 * difficulty + time-band chips, a serial tag, and Copy / Save actions.
 */
export default function PromptCard({ prompt }: PromptCardProps) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  // Reset the transient button states whenever a new prompt lands (new
  // seed/filters), and pick up the correct "already saved" state.
  useEffect(() => {
    setCopied(false)
    setSaved(prompt ? loadFavorites().some((f) => favId(f) === prompt.id) : false)
  }, [prompt?.id])

  if (!prompt) {
    return null
  }
  // Function parameters aren't narrowed inside nested closures, even
  // when never reassigned — bind to a const so TS keeps the non-null type.
  const resolvedPrompt = prompt

  async function handleCopy() {
    // navigator.clipboard is undefined in jsdom / some embedded contexts —
    // guard it rather than assume it exists.
    const clipboard = navigator.clipboard
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(resolvedPrompt.text)
      } catch {
        // Write can fail (permissions, unsupported); still surface feedback.
      }
    }
    setCopied(true)
  }

  function handleSave() {
    const added = addFavorite({ kind: 'prompt', prompt: resolvedPrompt })
    if (added || loadFavorites().some((f) => favId(f) === resolvedPrompt.id)) {
      setSaved(true)
    }
  }

  return (
    <div className="prompt-card">
      <span className="serial-tag">No {prompt.serial}</span>
      <p className="prompt-text">{prompt.text}</p>
      <div className="tag-row">
        <span className="tag-chip">{SUBJECT_LABELS[prompt.subject]}</span>
        <span className="tag-chip">{DIFFICULTY_LABELS[prompt.difficulty]}</span>
        <span className="tag-chip">{prompt.timeBand}</span>
      </div>
      <div className="prompt-actions">
        <button type="button" className="copy-button" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button type="button" className="save-button" onClick={handleSave}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  )
}
