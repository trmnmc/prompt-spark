/**
 * Northstar — guided project scaffolding.
 *
 * The state model behind the seven-screen flow from the "Northstar Flow"
 * design. Pure by contract: no Date.now, no Math.random, no network. The
 * caller passes `now`; model calls live in northstarAi.ts.
 *
 * The spine of the design is the no-surprises contract:
 *   1. only questions that change the plan
 *   2. limits shown before you invest, and again where they bite
 *   3. a plan you lock — nothing outside it gets built
 * Every type here exists to make one of those three enforceable.
 */
import { djb2 } from './rng'

export type Stage =
  | 'describe'
  | 'clarify'
  | 'capability'
  | 'decisions'
  | 'plan'
  | 'build'
  | 'handoff'

export const STAGES: { key: Stage; label: string; num: number }[] = [
  { key: 'describe', label: 'Describe', num: 1 },
  { key: 'clarify', label: 'Clarify', num: 2 },
  { key: 'capability', label: 'Capability', num: 3 },
  { key: 'decisions', label: 'Decisions', num: 4 },
  { key: 'plan', label: 'Plan & lock', num: 5 },
  { key: 'build', label: 'Swarm build', num: 6 },
  { key: 'handoff', label: 'Handoff', num: 7 },
]

/** One answered clarifying question. `shaped` is what it decided, e.g. "AUTH". */
export interface Answer {
  id: string
  question: string
  answer: string
  shaped: string
}

/** A clarifying question the model wants to ask. Staged until answered. */
export interface Question {
  question: string
  why: string
  options: string[]
  shapes: string
}

export interface SetupItem {
  name: string
  minutes: number
  detail: string
}

export interface OutOfScopeItem {
  name: string
  instead: string
}

/** The capability check: what's possible, before you invest anything. */
export interface CapabilityReport {
  checked: number
  ready: string[]
  needsSetup: SetupItem[]
  outOfScope: OutOfScopeItem[]
}

export interface DecisionOption {
  label: string
  rationale: string
  status: 'ready' | 'needs-setup'
  recommended: boolean
}

export interface Decision {
  id: string
  topic: string
  question: string
  options: DecisionOption[]
  /** null until the user picks. */
  chosen: string | null
  /** A limit from the capability check that resurfaces here. */
  limitNote: string | null
}

/** A §section of the locked spec. `traces` cites the answers that produced it. */
export interface SpecSection {
  id: string
  title: string
  body: string
  traces: string[]
}

export type TaskStatus = 'queued' | 'running' | 'done'

export interface Task {
  id: string
  phase: 'A' | 'B' | 'C'
  name: string
  section: string
  status: TaskStatus
  progress: number
}

export interface Project {
  id: string
  description: string
  tags: string[]
  answers: Answer[]
  capability: CapabilityReport | null
  decisions: Decision[]
  spec: SpecSection[]
  tasks: Task[]
  locked: boolean
  stage: Stage
  createdAt: number
  updatedAt: number
}

function hex(s: string): string {
  return djb2(s).toString(16).toUpperCase()
}

export function createProject(description: string, now: number): Project {
  return {
    id: hex(`ns:${description}:${now}`),
    description,
    tags: [],
    answers: [],
    capability: null,
    decisions: [],
    spec: [],
    tasks: [],
    locked: false,
    stage: 'clarify',
    createdAt: now,
    updatedAt: now,
  }
}

export function addAnswer(p: Project, q: Question, answer: string, now: number): Project {
  const id = hex(`a:${p.id}:${p.answers.length}:${answer}`)
  return {
    ...p,
    answers: [...p.answers, { id, question: q.question, answer, shaped: q.shapes }],
    updatedAt: now,
  }
}

export function setCapability(p: Project, report: CapabilityReport, now: number): Project {
  return { ...p, capability: report, updatedAt: now }
}

export function setDecisions(p: Project, decisions: Decision[], now: number): Project {
  return { ...p, decisions, updatedAt: now }
}

export function chooseOption(p: Project, decisionId: string, label: string, now: number): Project {
  const i = p.decisions.findIndex((d) => d.id === decisionId)
  if (i === -1) return p
  const decisions = [...p.decisions]
  decisions[i] = { ...decisions[i], chosen: label }
  return { ...p, decisions, updatedAt: now }
}

export function setPlan(p: Project, spec: SpecSection[], tasks: Task[], now: number): Project {
  return { ...p, spec, tasks, updatedAt: now }
}

/**
 * Lock is one-way and is the contract boundary: after this, the build may
 * only do what a §section says. Locking an incomplete plan is refused
 * rather than silently allowed — an empty contract constrains nothing.
 */
export function lockPlan(p: Project, now: number): Project {
  if (p.spec.length === 0) return p
  return { ...p, locked: true, stage: 'build', updatedAt: now }
}

export function goTo(p: Project, stage: Stage, now: number): Project {
  return { ...p, stage, updatedAt: now }
}

/** Every decision answered — the gate into plan review. */
export function decisionsComplete(p: Project): boolean {
  return p.decisions.length > 0 && p.decisions.every((d) => d.chosen !== null)
}

/** Tasks whose §section is not in the spec: the "no orphan work" check. */
export function orphanTasks(p: Project): Task[] {
  const ids = new Set(p.spec.map((s) => s.id))
  return p.tasks.filter((t) => !ids.has(t.section))
}

/** Simulated wall-clock cost of one task. */
export const TASK_MS = 3200

/**
 * Build state as a pure function of elapsed build time.
 *
 * Deriving from the clock rather than counting timer ticks matters: browsers
 * throttle timers in hidden tabs, and the design explicitly promises "you can
 * close this tab". Counting ticks would freeze the build the moment you did;
 * this catches up instead.
 */
export function buildProgress(tasks: Task[], elapsedMs: number): Task[] {
  return tasks.map((t, i) => {
    const pct = Math.round(((elapsedMs - i * TASK_MS) / TASK_MS) * 100)
    const progress = Math.max(0, Math.min(100, pct))
    const status: TaskStatus = progress >= 100 ? 'done' : progress > 0 ? 'running' : 'queued'
    return { ...t, status, progress }
  })
}

/** True once every task has had its full share of build time. */
export function buildComplete(tasks: Task[], elapsedMs: number): boolean {
  return tasks.length > 0 && elapsedMs >= tasks.length * TASK_MS
}

/**
 * The compass line: what's ahead, phrased as the design does — one sentence
 * naming the next commitment, never a bare step name.
 */
export function aheadText(stage: Stage): string {
  switch (stage) {
    case 'describe':
      return "Next I'll ask only questions that change the plan — usually three to five."
    case 'clarify':
      return 'Then I check everything against what the swarm can actually build.'
    case 'capability':
      return 'Accept this scope and we move to the decisions that are genuinely yours to make.'
    case 'decisions':
      return 'Then you review and lock the plan — the swarm builds only what is locked.'
    case 'plan':
      return 'Lock sends this to the swarm. It pauses only if the build would drift from what is written here.'
    case 'build':
      return 'Everything so far matches the locked plan. You can close this tab.'
    case 'handoff':
      return 'Built. Exactly what you locked.'
  }
}
