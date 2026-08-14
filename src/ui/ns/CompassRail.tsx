import { STAGES, aheadText, type Stage } from '../../core/northstar'

interface Props {
  stage: Stage
  projectName: string
  guidance?: string
  onJump?: (s: Stage) => void
}

/**
 * The compass: where you are and what's ahead. The design puts this at the
 * top of every screen precisely so "what's ahead" is never a mystery — the
 * AHEAD strip names the next commitment, not just the next step's title.
 */
export default function CompassRail({ stage, projectName, guidance = 'Smart', onJump }: Props) {
  const currentIndex = STAGES.findIndex((s) => s.key === stage)

  return (
    <header className="ns-rail" data-testid="compass">
      <div className="ns-rail-top">
        <span className="ns-mark" aria-hidden="true">
          N
        </span>
        <span className="ns-crumb">
          <strong>Northstar</strong> / {projectName}
        </span>
        <span className="ns-guidance">GUIDANCE: {guidance.toUpperCase()}</span>
      </div>

      <nav className="ns-steps" aria-label="Progress">
        {STAGES.map((s, i) => {
          const done = i < currentIndex
          const current = i === currentIndex
          const canJump = done && onJump !== undefined
          return (
            <button
              key={s.key}
              type="button"
              data-testid="compass-step"
              data-state={current ? 'current' : done ? 'done' : 'ahead'}
              aria-current={current ? 'step' : undefined}
              disabled={!canJump}
              onClick={canJump ? () => onJump(s.key) : undefined}
              className={[
                'ns-step',
                done ? 'ns-step--done' : '',
                current ? 'ns-step--current' : '',
                canJump ? 'ns-step--clickable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="ns-step-num">{done ? '✓' : s.num}</span>
              {s.label}
              {current && ' · you are here'}
            </button>
          )
        })}
      </nav>

      <div className="ns-ahead">
        <span className="ns-label">Ahead</span>
        <span className="ns-ahead-text" data-testid="ahead">
          {aheadText(stage)}
        </span>
      </div>
    </header>
  )
}
