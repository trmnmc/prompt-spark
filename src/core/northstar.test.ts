import { describe, expect, it } from 'vitest'

import {
  addAnswer,
  aheadText,
  chooseOption,
  createProject,
  decisionsComplete,
  goTo,
  lockPlan,
  orphanTasks,
  setCapability,
  setDecisions,
  setPlan,
  STAGES,
  TASK_MS,
  buildComplete,
  buildProgress,
  type Decision,
  type Question,
  type SpecSection,
  type Task,
} from './northstar'

const T0 = 1_700_000_000_000

const q: Question = {
  question: 'Who signs in?',
  why: 'It decides the auth model.',
  options: ['Clients only, invited', 'Anyone with a link'],
  shapes: 'AUTH',
}

const decision = (id: string, chosen: string | null = null): Decision => ({
  id,
  topic: 'sign-in',
  question: 'How should clients sign in?',
  options: [
    { label: 'Magic-link email', rationale: 'no password resets', status: 'ready', recommended: true },
    { label: 'Google sign-in', rationale: 'one click', status: 'needs-setup', recommended: false },
  ],
  chosen,
  limitNote: null,
})

const section = (id: string): SpecSection => ({
  id,
  title: 'Scope',
  body: 'Client portal.',
  traces: ['a1'],
})

const task = (id: string, sectionId: string): Task => ({
  id,
  phase: 'A',
  name: 'DB schema',
  section: sectionId,
  status: 'queued',
  progress: 0,
})

describe('project lifecycle', () => {
  it('starts at clarify — describe is already answered by creating it', () => {
    const p = createProject('a client portal', T0)
    expect(p.stage).toBe('clarify')
    expect(p.description).toBe('a client portal')
    expect(p.locked).toBe(false)
    expect(p.answers).toEqual([])
  })

  it('records answers with what they shaped', () => {
    const p = addAnswer(createProject('x', T0), q, 'Clients only, invited', T0 + 1)
    expect(p.answers).toHaveLength(1)
    expect(p.answers[0].shaped).toBe('AUTH')
    expect(p.answers[0].answer).toBe('Clients only, invited')
    expect(p.answers[0].id).toMatch(/^[0-9A-F]+$/)
  })

  it('never mutates the input project', () => {
    const before = createProject('x', T0)
    addAnswer(before, q, 'yes', T0 + 1)
    expect(before.answers).toEqual([])
  })

  it('gives distinct ids to identical answers', () => {
    let p = addAnswer(createProject('x', T0), q, 'same', T0 + 1)
    p = addAnswer(p, q, 'same', T0 + 2)
    expect(p.answers[0].id).not.toBe(p.answers[1].id)
  })
})

describe('decisions', () => {
  it('is incomplete until every decision is chosen', () => {
    let p = setDecisions(createProject('x', T0), [decision('d1'), decision('d2')], T0)
    expect(decisionsComplete(p)).toBe(false)
    p = chooseOption(p, 'd1', 'Magic-link email', T0 + 1)
    expect(decisionsComplete(p)).toBe(false)
    p = chooseOption(p, 'd2', 'Google sign-in', T0 + 2)
    expect(decisionsComplete(p)).toBe(true)
  })

  it('is not complete when there are no decisions at all', () => {
    expect(decisionsComplete(createProject('x', T0))).toBe(false)
  })

  it('ignores an unknown decision id', () => {
    const p = setDecisions(createProject('x', T0), [decision('d1')], T0)
    expect(chooseOption(p, 'nope', 'x', T0 + 1)).toBe(p)
  })
})

describe('lock — the contract boundary', () => {
  it('refuses to lock an empty plan', () => {
    const p = createProject('x', T0)
    expect(lockPlan(p, T0 + 1).locked).toBe(false)
  })

  it('locks a plan that has sections and advances to build', () => {
    let p = setPlan(createProject('x', T0), [section('§1')], [task('t1', '§1')], T0)
    p = lockPlan(p, T0 + 1)
    expect(p.locked).toBe(true)
    expect(p.stage).toBe('build')
  })
})

describe('no orphan work', () => {
  it('finds tasks whose section is not in the spec', () => {
    const p = setPlan(
      createProject('x', T0),
      [section('§1')],
      [task('t1', '§1'), task('t2', '§9')],
      T0,
    )
    expect(orphanTasks(p).map((t) => t.id)).toEqual(['t2'])
  })

  it('is empty when every task maps to a section', () => {
    const p = setPlan(createProject('x', T0), [section('§1')], [task('t1', '§1')], T0)
    expect(orphanTasks(p)).toEqual([])
  })
})

describe('build progress is a pure function of elapsed time', () => {
  const three = [task('t1', '§1'), task('t2', '§1'), task('t3', '§1')]

  it('has everything queued at zero', () => {
    expect(buildProgress(three, 0).map((t) => t.status)).toEqual(['queued', 'queued', 'queued'])
  })

  it('runs the first task partway through its slice', () => {
    const [a, b] = buildProgress(three, TASK_MS / 2)
    expect(a.status).toBe('running')
    expect(a.progress).toBe(50)
    expect(b.status).toBe('queued')
  })

  it('completes tasks in order as time passes', () => {
    expect(buildProgress(three, TASK_MS * 2).map((t) => t.status)).toEqual([
      'done',
      'done',
      'queued',
    ])
  })

  it('catches up after a throttled gap instead of losing progress', () => {
    // A hidden tab may deliver no ticks at all; jumping straight to the end
    // must still produce a finished build, not a stalled one.
    expect(buildProgress(three, TASK_MS * 99).every((t) => t.status === 'done')).toBe(true)
  })

  it('never reports negative or over-100 progress', () => {
    for (const ms of [-5000, 0, 1, TASK_MS * 3, TASK_MS * 100]) {
      for (const t of buildProgress(three, ms)) {
        expect(t.progress).toBeGreaterThanOrEqual(0)
        expect(t.progress).toBeLessThanOrEqual(100)
      }
    }
  })

  it('knows when the build is complete', () => {
    expect(buildComplete(three, TASK_MS * 3 - 1)).toBe(false)
    expect(buildComplete(three, TASK_MS * 3)).toBe(true)
    expect(buildComplete([], 999_999)).toBe(false)
  })
})

describe('capability + navigation', () => {
  it('stores the capability report', () => {
    const p = setCapability(
      createProject('x', T0),
      { checked: 34, ready: ['galleries'], needsSetup: [], outOfScope: [] },
      T0 + 1,
    )
    expect(p.capability?.checked).toBe(34)
  })

  it('moves between stages and stamps updatedAt', () => {
    const p = goTo(createProject('x', T0), 'capability', T0 + 5)
    expect(p.stage).toBe('capability')
    expect(p.updatedAt).toBe(T0 + 5)
  })
})

describe('compass', () => {
  it('has seven stages in the design order', () => {
    expect(STAGES.map((s) => s.key)).toEqual([
      'describe',
      'clarify',
      'capability',
      'decisions',
      'plan',
      'build',
      'handoff',
    ])
  })

  it('names the next commitment for every stage', () => {
    for (const s of STAGES) {
      expect(aheadText(s.key).length).toBeGreaterThan(20)
    }
  })
})
