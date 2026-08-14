import type { CapabilityReport } from '../../core/northstar'

interface Props {
  report: CapabilityReport
  onAccept: () => void
  onAdjust: () => void
}

/**
 * Step 3. The point of this screen is that limits arrive BEFORE you invest,
 * never at build time — and each out-of-scope item carries a concrete
 * "instead", so a limit is never just a refusal.
 */
export default function CapabilityScreen({ report, onAccept, onAdjust }: Props) {
  return (
    <div data-testid="screen-capability">
      <div className="ns-label">Step 3 · Capability check</div>
      <h1 className="ns-h">What&rsquo;s possible — before you invest anything.</h1>
      <p className="ns-sub">
        <strong>{report.checked} capabilities checked.</strong> Your description, against what the
        swarm can actually build.{' '}
        {report.outOfScope.length + report.needsSetup.length > 0
          ? 'Limits found now — not at build time.'
          : 'No limits found.'}
      </p>

      <section className="ns-cap ns-cap--ready" data-testid="cap-ready">
        <div className="ns-cap-head">
          <span className="ns-cap-mark">✓</span> Ready to build
          <span className="ns-cap-count">{report.ready.length}</span>
        </div>
        <ul>
          {report.ready.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      {report.needsSetup.length > 0 && (
        <section className="ns-cap ns-cap--setup" data-testid="cap-setup">
          <div className="ns-cap-head">
            <span className="ns-cap-mark">◆</span> Needs setup from you
            <span className="ns-cap-count">{report.needsSetup.length}</span>
          </div>
          <ul>
            {report.needsSetup.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong> <span className="ns-mins">~{s.minutes} MIN</span>
                <div className="ns-cap-detail">{s.detail}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.outOfScope.length > 0 && (
        <section className="ns-cap ns-cap--out" data-testid="cap-out">
          <div className="ns-cap-head">
            <span className="ns-cap-mark">✕</span> Out of scope
            <span className="ns-cap-count">{report.outOfScope.length}</span>
          </div>
          <ul>
            {report.outOfScope.map((o) => (
              <li key={o.name}>
                <strong>{o.name}</strong>
                <div className="ns-cap-detail">→ Instead: {o.instead}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ns-actions">
        <button type="button" className="ns-btn ns-btn--primary" onClick={onAccept}>
          Accept scope →
        </button>
        <button type="button" className="ns-btn" onClick={onAdjust}>
          Adjust project
        </button>
      </div>
      <p className="ns-sub" style={{ marginTop: 12, fontSize: 12.5 }}>
        Both limits reappear wherever they matter — you&rsquo;ll never meet them as a surprise.
      </p>
    </div>
  )
}
