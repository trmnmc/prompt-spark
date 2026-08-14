import type { Decision } from '../../core/northstar'

interface Props {
  decisions: Decision[]
  onChoose: (decisionId: string, label: string) => void
  onContinue: () => void
  complete: boolean
}

/**
 * Step 4. Only genuine tradeoffs reach this screen, and every option is
 * pre-checked against the swarm's abilities — the design's "no dead ends"
 * rule. Limits from step 3 resurface here, where they actually bite.
 */
export default function DecisionsScreen({ decisions, onChoose, onContinue, complete }: Props) {
  const settled = decisions.filter((d) => d.chosen !== null).length

  return (
    <div data-testid="screen-decisions">
      <div className="ns-label">
        Step 4 · {settled} of {decisions.length} settled
      </div>
      <h1 className="ns-h">The decisions that are genuinely yours.</h1>
      <p className="ns-sub">
        Every option below is pre-checked against what the swarm can build — no dead ends.
      </p>

      {decisions.map((d) => (
        <section key={d.id} className="ns-card ns-decision" data-testid="decision">
          <div className="ns-label">{d.topic}</div>
          <h2 className="ns-decision-q">{d.question}</h2>

          <div className="ns-decision-options">
            {d.options.map((o) => {
              const chosen = d.chosen === o.label
              return (
                <button
                  key={o.label}
                  type="button"
                  data-testid="decision-option"
                  aria-pressed={chosen}
                  className={chosen ? 'ns-opt ns-opt--chosen' : 'ns-opt'}
                  onClick={() => onChoose(d.id, o.label)}
                >
                  <span className="ns-opt-head">
                    <strong>{o.label}</strong>
                    {o.recommended && <span className="ns-rec">Recommended</span>}
                    <span className={o.status === 'ready' ? 'ns-ready' : 'ns-setup'}>
                      {o.status === 'ready' ? '✓ Ready' : '◆ Needs setup'}
                    </span>
                  </span>
                  <span className="ns-opt-why">{o.rationale}</span>
                </button>
              )
            })}
          </div>

          {d.limitNote && (
            <p className="ns-limit" data-testid="limit-note">
              ! {d.limitNote}
            </p>
          )}
        </section>
      ))}

      <div className="ns-actions">
        <button
          type="button"
          className="ns-btn ns-btn--primary"
          disabled={!complete}
          onClick={onContinue}
        >
          Continue → Plan review
        </button>
        {!complete && <span className="ns-sub" style={{ margin: 0 }}>Every decision needs an answer.</span>}
      </div>
    </div>
  )
}
