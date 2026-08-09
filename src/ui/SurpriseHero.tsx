export interface SurpriseHeroProps {
  onSpark: () => void
  /** True while an AI generation is in flight — shows progress, blocks re-taps. */
  loading?: boolean
}

/**
 * The hero action: a big, thumb-friendly button that draws a fresh seed
 * (template mode) or asks Claude for a brand-new prompt (AI mode).
 * The resulting generated prompt renders separately via PromptCard.
 */
export default function SurpriseHero({ onSpark, loading = false }: SurpriseHeroProps) {
  return (
    <div className="hero-area">
      <button type="button" className="surprise-hero" onClick={onSpark} disabled={loading}>
        {loading ? 'Sparking…' : 'Surprise me ✨'}
      </button>
    </div>
  )
}
