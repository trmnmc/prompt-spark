import { useEffect, useMemo, useRef, useState } from 'react'

import { AiError } from '../../core/ai'
import { makeAnthropicClient, type ModelClient } from '../../core/interview'
import {
  addAnswer,
  chooseOption,
  createProject,
  decisionsComplete,
  goTo,
  lockPlan,
  orphanTasks,
  setCapability,
  setDecisions,
  setPlan,
  buildComplete,
  buildProgress,
  type Project,
  type Question,
  type Stage,
} from '../../core/northstar'
import {
  buildPlan,
  checkCapabilities,
  copilotSay,
  nextQuestion,
  proposeDecisions,
} from '../../core/northstarAi'
import { aiReady, useSettings } from '../../state/settings'
import '../../styles/northstar.css'
import CapabilityScreen from './CapabilityScreen'
import ClarifyScreen from './ClarifyScreen'
import CompassRail from './CompassRail'
import CopilotDock from './CopilotDock'
import DecisionsScreen from './DecisionsScreen'
import DescribeScreen from './DescribeScreen'
import HandoffScreen from './HandoffScreen'
import PlanLockScreen from './PlanLockScreen'
import SwarmBuildScreen, { type DriftEvent } from './SwarmBuildScreen'

const DRIFT: DriftEvent = {
  finding:
    'Your locked plan caps file storage per project. While building uploads, an agent found your ' +
    'sample files average 400 MB — a dozen projects would hit the cap within weeks.',
  cost: 'Fixing it properly means a larger tier, which adds ongoing cost — something you never agreed to. So I stopped.',
  keepLabel: 'Keep the plan',
  keepDetail: 'Add a "storage nearly full" warning instead. No extra cost. Resumes in seconds.',
  allowLabel: 'Allow the larger tier',
  allowDetail: 'Updates the section, re-locks the plan, resumes. You approve the cost once, here.',
}

export default function NorthstarApp() {
  const [project, setProject] = useState<Project | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [busy, setBusy] = useState(false)
  const [copilot, setCopilot] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [drift, setDrift] = useState<DriftEvent | null>(null)
  const [driftResolved, setDriftResolved] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const ticket = useRef(0)
  const buildStartedAt = useRef<number | null>(null)
  const pausedAt = useRef<number | null>(null)
  const pausedTotal = useRef(0)

  const settings = useSettings()
  const client: ModelClient | null = useMemo(
    () =>
      aiReady(settings)
        ? makeAnthropicClient(settings.apiKey, settings.model, settings.baseUrl)
        : null,
    [settings],
  )

  const stage: Stage = project?.stage ?? 'describe'
  const orphans = project ? orphanTasks(project) : []

  /** One place to run a model-backed step: tickets guard against stale results. */
  async function run<T>(fn: () => Promise<T>, onOk: (value: T) => void) {
    const mine = ++ticket.current
    setBusy(true)
    setNote(null)
    try {
      const value = await fn()
      if (mine !== ticket.current) return
      onOk(value)
    } catch (e) {
      if (mine !== ticket.current) return
      const err = e instanceof AiError ? e : new AiError('Unexpected error.', true)
      setNote(`${err.message} Falling back to the built-in flow.`)
    } finally {
      if (mine === ticket.current) setBusy(false)
    }
  }

  function advise(p: Project, situation: string, fallback: string) {
    void copilotSay(client, p, situation, fallback).then(setCopilot)
  }

  function handleStart(description: string) {
    const p = createProject(description, Date.now())
    setProject(p)
    advise(
      p,
      'just described the project',
      'Good start. Next I ask only the questions that would change the plan — nothing more.',
    )
    void run(
      () => nextQuestion(client, p),
      (q) => setQuestion(q),
    )
  }

  function handleAnswer(answer: string) {
    if (!project || !question) return
    const p = addAnswer(project, question, answer, Date.now())
    setProject(p)
    setQuestion(null)
    void run(
      () => nextQuestion(client, p),
      (q) => {
        setQuestion(q)
        if (q === null) {
          const next = goTo(p, 'capability', Date.now())
          setProject(next)
          advise(
            next,
            'moving to the capability check',
            'Now I check everything you said against what can actually be built — limits surface here, not at build time.',
          )
          void run(
            () => checkCapabilities(client, next),
            (report) => setProject(setCapability(next, report, Date.now())),
          )
        }
      },
    )
  }

  function handleAcceptScope() {
    if (!project) return
    const p = goTo(project, 'decisions', Date.now())
    setProject(p)
    advise(
      p,
      'moving to decisions',
      'These are the calls that are genuinely yours. I mark one recommendation per decision and say why.',
    )
    void run(
      () => proposeDecisions(client, p),
      (decisions) => setProject(setDecisions(p, decisions, Date.now())),
    )
  }

  function handleContinueToPlan() {
    if (!project) return
    const { spec, tasks } = buildPlan(project)
    const p = goTo(setPlan(project, spec, tasks, Date.now()), 'plan', Date.now())
    setProject(p)
    advise(
      p,
      'reviewing the plan before lock',
      'Read it once. After lock, anything the build wants that this does not say comes back to you as a question.',
    )
  }

  function handleLock() {
    if (!project) return
    const p = lockPlan(project, Date.now())
    if (!p.locked) return
    buildStartedAt.current = Date.now()
    pausedAt.current = null
    pausedTotal.current = 0
    setProject(p)
    setElapsed(0)
    setLog(['compass · plan locked — conformance watch on'])
    setCopilot('Locked. I only interrupt you if the build would diverge from what you just read.')
  }

  /**
   * The simulated build. No swarm exists; the screen says so.
   *
   * Progress is derived from wall-clock time, never from counting ticks:
   * browsers throttle timers in hidden tabs, and the design promises "you can
   * close this tab". The interval only drives re-renders — if it fires twice
   * in a minute, the build still shows the right state when you look.
   */
  useEffect(() => {
    if (stage !== 'build') return
    const recompute = () => {
      setProject((prev) => {
        if (prev === null || prev.stage !== 'build' || buildStartedAt.current === null) return prev
        const held = drift !== null && pausedAt.current !== null ? Date.now() - pausedAt.current : 0
        const ms = Date.now() - buildStartedAt.current - pausedTotal.current - held
        setElapsed(Math.max(0, Math.floor(ms / 1000)))
        if (drift !== null) return prev
        const tasks = buildProgress(prev.tasks, ms)
        if (buildComplete(tasks, ms)) return { ...prev, tasks, stage: 'handoff' }
        return { ...prev, tasks }
      })
    }
    recompute()
    const id = window.setInterval(recompute, 400)
    const onVisible = () => recompute()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [stage, drift])

  /**
   * Log and drift are derived from completed tasks, not emitted mid-update.
   * `logged` makes it idempotent, so a re-render can never double-log.
   */
  const logged = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (project === null || project.stage !== 'build') return
    const done = project.tasks.filter((t) => t.status === 'done')
    const fresh = done.filter((t) => !logged.current.has(t.id))
    if (fresh.length > 0) {
      fresh.forEach((t) => logged.current.add(t.id))
      setLog((l) => [
        ...l,
        ...fresh.map((t) => `agt · ${t.name} → ${t.section} complete · conformance OK`),
      ])
    }
    if (done.length >= 4 && drift === null && driftResolved === null) {
      pausedAt.current = Date.now()
      setDrift(DRIFT)
    }
  }, [project, drift, driftResolved])

  function resolveDrift(kept: boolean) {
    // Time spent held is not build time — add it back so the simulation
    // does not silently skip ahead while the user was reading.
    if (pausedAt.current !== null) {
      pausedTotal.current += Date.now() - pausedAt.current
      pausedAt.current = null
    }
    setDrift(null)
    setDriftResolved(kept ? 'plan kept, warning added' : 'larger tier approved')
    setLog((l) => [
      ...l,
      kept
        ? 'compass · drift resolved — plan unchanged, warning added'
        : 'compass · drift resolved — section updated and re-locked',
    ])
  }

  function handleCopySpec() {
    if (!project) return
    const text = project.spec.map((s) => `${s.id} ${s.title}. ${s.body}`).join('\n\n')
    const clipboard = navigator.clipboard
    if (!clipboard?.writeText) {
      setNote('Copy failed — select the text manually.')
      return
    }
    clipboard.writeText(text).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => setNote('Copy failed — select the text manually.'),
    )
  }

  function reset() {
    ticket.current++
    logged.current.clear()
    buildStartedAt.current = null
    pausedAt.current = null
    pausedTotal.current = 0
    setProject(null)
    setQuestion(null)
    setCopilot(null)
    setNote(null)
    setDrift(null)
    setDriftResolved(null)
    setElapsed(0)
    setLog([])
  }

  return (
    <div className="ns-app">
      <CompassRail
        stage={stage}
        projectName={project === null ? 'new project' : summarize(project.description)}
        onJump={
          project === null || project.locked
            ? undefined
            : (s) => setProject(goTo(project, s, Date.now()))
        }
      />

      <main className="ns-body">
        {note && <p className="ns-note">{note}</p>}

        {project === null && <DescribeScreen onStart={handleStart} busy={busy} />}

        {project !== null && stage === 'clarify' && (
          <ClarifyScreen
            answers={project.answers}
            question={question}
            busy={busy}
            onAnswer={handleAnswer}
          />
        )}

        {project !== null && stage === 'capability' && (
          <>
            {project.capability === null ? (
              <p className="ns-sub">Checking capabilities…</p>
            ) : (
              <CapabilityScreen
                report={project.capability}
                onAccept={handleAcceptScope}
                onAdjust={reset}
              />
            )}
          </>
        )}

        {project !== null && stage === 'decisions' && (
          <>
            {project.decisions.length === 0 ? (
              <p className="ns-sub">Working out the tradeoffs…</p>
            ) : (
              <DecisionsScreen
                decisions={project.decisions}
                complete={decisionsComplete(project)}
                onChoose={(id, label) => setProject(chooseOption(project, id, label, Date.now()))}
                onContinue={handleContinueToPlan}
              />
            )}
          </>
        )}

        {project !== null && stage === 'plan' && (
          <PlanLockScreen
            spec={project.spec}
            tasks={project.tasks}
            orphans={orphans}
            onLock={handleLock}
            onBack={() => setProject(goTo(project, 'decisions', Date.now()))}
          />
        )}

        {project !== null && stage === 'build' && (
          <SwarmBuildScreen
            tasks={project.tasks}
            elapsed={elapsed}
            log={log}
            drift={drift}
            onKeepPlan={() => resolveDrift(true)}
            onAllowChange={() => resolveDrift(false)}
          />
        )}

        {project !== null && stage === 'handoff' && (
          <HandoffScreen
            project={project}
            elapsed={elapsed}
            driftResolved={driftResolved}
            onRestart={reset}
            onCopySpec={handleCopySpec}
            copied={copied}
          />
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
