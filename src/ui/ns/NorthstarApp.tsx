import { useState } from 'react'

import { createProject, goTo, type Project, type Stage } from '../../core/northstar'
import '../../styles/northstar.css'
import CompassRail from './CompassRail'
import CopilotDock from './CopilotDock'
import DescribeScreen from './DescribeScreen'

/**
 * The Northstar flow. Screens land one slice at a time; anything not yet
 * built announces itself rather than pretending, so a half-finished flow is
 * never mistaken for a working one.
 */
export default function NorthstarApp() {
  const [project, setProject] = useState<Project | null>(null)
  const [busy, setBusy] = useState(false)
  const [copilot, setCopilot] = useState<string | null>(null)

  const stage: Stage = project?.stage ?? 'describe'
  const name = project === null ? 'new project' : summarize(project.description)

  function handleStart(description: string) {
    setBusy(true)
    const p = createProject(description, Date.now())
    setProject(p)
    setCopilot(
      'Good start. I read your description — next I ask only the questions that would change ' +
        'the plan, and nothing else.',
    )
    setBusy(false)
  }

  function handleJump(s: Stage) {
    if (project === null) return
    setProject(goTo(project, s, Date.now()))
  }

  return (
    <div className="ns-app">
      <CompassRail
        stage={stage}
        projectName={name}
        onJump={project === null ? undefined : handleJump}
      />

      <main className="ns-body">
        {project === null ? (
          <DescribeScreen onStart={handleStart} busy={busy} />
        ) : (
          <NotBuiltYet stage={stage} project={project} />
        )}
      </main>

      <CopilotDock message={copilot} thinking={busy} />
    </div>
  )
}

function summarize(description: string): string {
  const first = description.trim().split(/[.\n]/)[0]
  return first.length > 46 ? `${first.slice(0, 46)}…` : first
}

/**
 * An explicit placeholder. The alternative — a blank screen or a mocked one
 * that looks real — is how a demo gets mistaken for a product.
 */
function NotBuiltYet({ stage, project }: { stage: Stage; project: Project }) {
  return (
    <div data-testid="not-built">
      <div className="ns-label">Step · {stage}</div>
      <h1 className="ns-h">This screen isn&rsquo;t built yet</h1>
      <p className="ns-sub">
        The describe step is real and your description is captured. Everything from{' '}
        <strong>{stage}</strong> onward is still to come.
      </p>
      <div className="ns-card">
        <div className="ns-label">Captured description</div>
        <p style={{ lineHeight: 1.6, margin: '8px 0 0' }}>{project.description}</p>
      </div>
    </div>
  )
}
