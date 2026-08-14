import type { Task } from '../../core/northstar'

export interface DriftEvent {
  finding: string
  cost: string
  keepLabel: string
  keepDetail: string
  allowLabel: string
  allowDetail: string
}

interface Props {
  tasks: Task[]
  elapsed: number
  log: string[]
  drift: DriftEvent | null
  onKeepPlan: () => void
  onAllowChange: () => void
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Step 6, and the drift pause that is the design's signature moment.
 *
 * SIMULATED. There is no swarm behind this — tasks advance on a local timer.
 * The screen says so in as many words, because a fake progress bar that
 * doesn't admit it is the most dishonest thing a demo can do.
 */
export default function SwarmBuildScreen({
  tasks,
  elapsed,
  log,
  drift,
  onKeepPlan,
  onAllowChange,
}: Props) {
  const done = tasks.filter((t) => t.status === 'done').length

  return (
    <div data-testid="screen-build">
      <p className="ns-note" data-testid="sim-banner">
        Simulated build. Northstar runs in your browser and has no swarm attached — these tasks
        advance on a timer so you can walk the flow. The locked plan above is the real artifact.
      </p>

      <div className="ns-label">Step 6 · Swarm build</div>
      <h1 className="ns-h">
        {drift ? 'Paused — drift caught' : `Building · ${done} of ${tasks.length} done`}
      </h1>
      <p className="ns-sub">
        Elapsed {mmss(elapsed)} · the build auto-continues while it matches the locked plan.
      </p>

      {drift && (
        <section className="ns-drift" data-testid="drift">
          <div className="ns-label" style={{ color: 'var(--ns-amber-dark)' }}>
            ⏸ Build held · 3 other tasks still running
          </div>
          <p className="ns-drift-finding">{drift.finding}</p>
          <p className="ns-drift-cost">{drift.cost}</p>
          <div className="ns-drift-actions">
            <button
              type="button"
              className="ns-btn ns-btn--primary"
              data-testid="drift-keep"
              onClick={onKeepPlan}
            >
              {drift.keepLabel}
              <span className="ns-opt-why">{drift.keepDetail}</span>
            </button>
            <button
              type="button"
              className="ns-btn"
              data-testid="drift-allow"
              onClick={onAllowChange}
            >
              {drift.allowLabel}
              <span className="ns-opt-why">{drift.allowDetail}</span>
            </button>
          </div>
          <p className="ns-sub" style={{ marginTop: 10, fontSize: 12.5 }}>
            This is the only kind of interruption you get: the build wanted something the plan
            doesn&rsquo;t say. Everything else keeps running.
          </p>
        </section>
      )}

      <section className="ns-card" data-testid="agents">
        <div className="ns-label">Agents on the locked plan</div>
        {tasks
          .filter((t) => t.status !== 'queued')
          .concat(tasks.filter((t) => t.status === 'queued').slice(0, 2))
          .map((t) => (
            <div key={t.id} className="ns-agent" data-testid="agent">
              <span className="ns-agent-name">
                {t.name} <span className="ns-sec-ref">{t.section}</span>
              </span>
              <span className="ns-agent-state">
                {t.status === 'done' ? 'Done ✓' : t.status === 'running' ? `${t.progress}%` : 'queued'}
              </span>
              <span className="ns-bar">
                <span
                  className="ns-bar-fill"
                  style={{ width: `${t.status === 'done' ? 100 : t.progress}%` }}
                />
              </span>
            </div>
          ))}
      </section>

      <section className="ns-card ns-log" style={{ marginTop: 14 }} data-testid="log">
        <div className="ns-label">Conformance log</div>
        {log.slice(-6).map((line, i) => (
          <div key={`${line}-${i}`} className="ns-log-line">
            {line}
          </div>
        ))}
      </section>
    </div>
  )
}
