import type { SpecSection, Task } from '../../core/northstar'

interface Props {
  spec: SpecSection[]
  tasks: Task[]
  orphans: Task[]
  onLock: () => void
  onBack: () => void
}

/**
 * Step 5. The contract screen. Two invariants are shown rather than asserted:
 * every §section cites what produced it, and every task names the §section it
 * serves — with orphans surfaced loudly if the invariant ever breaks.
 */
export default function PlanLockScreen({ spec, tasks, orphans, onLock, onBack }: Props) {
  const phases: ('A' | 'B' | 'C')[] = ['A', 'B', 'C']

  return (
    <div data-testid="screen-plan">
      <div className="ns-label">Step 5 · Plan review &amp; lock</div>
      <h1 className="ns-h">The contract — nothing outside it gets built.</h1>
      <p className="ns-sub">
        Every section traces to something you said or chose. Lock sends exactly this to the swarm.
      </p>

      <section className="ns-card" data-testid="spec">
        <div className="ns-label">Spec document</div>
        {spec.map((s) => (
          <div key={s.id} className="ns-section" data-testid="spec-section">
            <div className="ns-section-head">
              <span className="ns-sec-id">{s.id}</span>
              <strong>{s.title}</strong>
            </div>
            <p className="ns-section-body">{s.body}</p>
            <p className="ns-trace">traces to: {s.traces.join(' · ')}</p>
          </div>
        ))}
      </section>

      <section className="ns-card" style={{ marginTop: 14 }} data-testid="tasks">
        <div className="ns-label">
          Task graph · {tasks.length} tasks ·{' '}
          {orphans.length === 0 ? 'all map to a § — no orphan work' : `${orphans.length} ORPHANED`}
        </div>
        {phases.map((ph) => {
          const inPhase = tasks.filter((t) => t.phase === ph)
          if (inPhase.length === 0) return null
          return (
            <div key={ph} className="ns-phase">
              <div className="ns-phase-label">Phase {ph}</div>
              <div className="ns-phase-tasks">
                {inPhase.map((t) => (
                  <span key={t.id} className="ns-task" data-testid="task">
                    {t.name} <span className="ns-sec-ref">{t.section}</span>
                  </span>
                ))}
                <span className="ns-checkpoint">◆ Checkpoint</span>
              </div>
            </div>
          )
        })}
      </section>

      {orphans.length > 0 && (
        <p className="ns-note" data-testid="orphan-warning">
          {orphans.length} task(s) do not map to any §section. The plan cannot be locked until every
          task traces to the contract.
        </p>
      )}

      <div className="ns-actions">
        <button
          type="button"
          className="ns-btn ns-btn--primary"
          disabled={spec.length === 0 || orphans.length > 0}
          onClick={onLock}
        >
          🔒 Lock → send to swarm
        </button>
        <button type="button" className="ns-btn" onClick={onBack}>
          Back to decisions
        </button>
      </div>
      <p className="ns-sub" style={{ marginTop: 12, fontSize: 12.5 }}>
        After lock, every change comes back to you as a question — never as a surprise.
      </p>
    </div>
  )
}
