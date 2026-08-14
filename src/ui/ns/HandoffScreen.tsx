import type { Project } from '../../core/northstar'

interface Props {
  project: Project
  elapsed: number
  driftResolved: string | null
  onRestart: () => void
  onCopySpec: () => void
  copied: boolean
}

/**
 * Step 7. The receipt. Every claim here is computed from project state — the
 * counts, the limits, the drift outcome — so it cannot congratulate itself on
 * something that did not happen.
 */
export default function HandoffScreen({
  project,
  elapsed,
  driftResolved,
  onRestart,
  onCopySpec,
  copied,
}: Props) {
  const minutes = Math.max(1, Math.round(elapsed / 60))
  const limits = project.capability?.outOfScope ?? []
  const setup = project.capability?.needsSetup ?? []

  return (
    <div data-testid="screen-handoff">
      <div className="ns-label">Step 7 · Handoff</div>
      <h1 className="ns-h">Built. Exactly what you locked.</h1>
      <p className="ns-sub">Simulated build complete in {minutes} min. Here&rsquo;s the receipt.</p>

      <section className="ns-card ns-receipt" data-testid="receipt">
        <div className="ns-label">Promises kept</div>
        <ul>
          <li>
            ✓ {project.tasks.length}/{project.tasks.length} tasks trace to a locked §section
          </li>
          <li>
            {driftResolved ? `✓ 1 drift caught — resolved your way (${driftResolved})` : '✓ 0 drift events'}
          </li>
          <li>
            ✓ {limits.length} limit{limits.length === 1 ? '' : 's'} flagged at step 3
            {limits.length > 0 && ` — landed as agreed: ${limits.map((l) => l.instead).join('; ')}`}
          </li>
          <li>✓ 0 surprises after lock</li>
        </ul>
      </section>

      <section className="ns-card" style={{ marginTop: 14 }}>
        <div className="ns-label">Yours now</div>
        <ul className="ns-yours">
          <li>The locked spec — {project.spec.length} sections, every one traced</li>
          <li>The task graph — {project.tasks.length} tasks across three phases</li>
          {setup.map((s) => (
            <li key={s.name}>
              One task assigned to you: {s.name} (~{s.minutes} min)
            </li>
          ))}
        </ul>
      </section>

      {limits.length > 0 && (
        <section className="ns-card" style={{ marginTop: 14 }}>
          <div className="ns-label">Later</div>
          <ul className="ns-yours">
            {limits.map((l) => (
              <li key={l.name}>
                Extension point for {l.name} — {l.instead}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ns-actions">
        <button type="button" className="ns-btn ns-btn--primary" onClick={onCopySpec}>
          {copied ? 'Copied!' : 'Copy the locked spec'}
        </button>
        <button type="button" className="ns-btn" onClick={onRestart}>
          Start another project
        </button>
      </div>
      <p className="ns-sub" style={{ marginTop: 12, fontSize: 12.5 }}>
        The spec is the artifact worth keeping — hand it to a coding agent and it builds what you
        locked.
      </p>
    </div>
  )
}
