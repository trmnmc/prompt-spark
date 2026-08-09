export interface SurpriseHeroProps {
  onSpark: () => void
}

/**
 * The hero action: a big, thumb-friendly button that draws a fresh seed.
 * The resulting generated prompt renders separately via PromptCard.
 */
export default function SurpriseHero({ onSpark }: SurpriseHeroProps) {
  return (
    <div className="hero-area">
      <button type="button" className="surprise-hero" onClick={onSpark}>
        Surprise me ✨
      </button>
    </div>
  )
}
