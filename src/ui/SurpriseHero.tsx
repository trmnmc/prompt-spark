export interface SurpriseHeroProps {
  seed: number | null
  onSpark: () => void
}

/**
 * The hero action. Stub: shows the chosen seed as placeholder text once
 * tapped. Real generate() wiring lands in a later item.
 */
export default function SurpriseHero({ seed, onSpark }: SurpriseHeroProps) {
  return (
    <div className="hero-area">
      <button type="button" className="surprise-hero" onClick={onSpark}>
        Surprise me ✨
      </button>
      {seed !== null && (
        <div className="prompt-card">
          <p>Seed no. {seed} ready — generator wiring lands soon</p>
        </div>
      )}
    </div>
  )
}
