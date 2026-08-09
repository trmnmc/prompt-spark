/**
 * Brain Scout view stub. The 4-rung ladder + 3 lens remix expansion
 * lands in a later item; this is the compiling, typed shell for now.
 */
export default function BrainScoutView() {
  return (
    <section className="scout-view">
      <h2>Brain Scout</h2>
      <div className="scout-input-row">
        <input type="text" placeholder="Type a seed idea…" aria-label="Seed idea" />
        <button type="button" disabled>
          Scout it
        </button>
      </div>
      <p className="scout-note">expansion lands soon</p>
    </section>
  )
}
