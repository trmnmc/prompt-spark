import type { GeneratedPrompt } from '../core/types'

export interface PromptCardProps {
  prompt?: GeneratedPrompt
}

/**
 * Renders a resolved prompt. Stub: renders nothing when no prompt is
 * supplied — the real render (text, tags, serial, copy/favorite actions)
 * lands next wave once generate() exists.
 */
export default function PromptCard({ prompt }: PromptCardProps) {
  if (!prompt) {
    return null
  }

  return (
    <div className="prompt-card">
      <span className="serial-tag">{prompt.serial}</span>
      <p>{prompt.text}</p>
      <span className="tag-chip">{prompt.difficulty}</span>
      <span className="tag-chip">{prompt.timeBand}</span>
    </div>
  )
}
