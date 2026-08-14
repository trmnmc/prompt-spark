/**
 * Northstar's thinking layer.
 *
 * Every function has two paths: a model call when a key is configured, and a
 * deterministic local fallback when there isn't one. The fallback is not a
 * stub — it produces a complete, walkable flow from the description alone, so
 * the whole seven-screen product works before any key exists and degrades to
 * something honest rather than empty when a call fails.
 */
import { AiError } from './ai'
import type { ModelClient } from './interview'
import type {
  CapabilityReport,
  Decision,
  Project,
  Question,
  SpecSection,
  Task,
} from './northstar'
import { djb2 } from './rng'

function hex(s: string): string {
  return djb2(s).toString(16).toUpperCase()
}

function stripFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\n?|\n?```$/g, '')
}

function parseJson(raw: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(raw))
  } catch {
    throw new AiError('Model returned unparseable output.', true)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new AiError('Model output had the wrong shape.', true)
  }
  return parsed as Record<string, unknown>
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback
}

function context(p: Project): string {
  const answered = p.answers.map((a) => `- ${a.question} → ${a.answer} [shaped ${a.shaped}]`)
  return [
    `Project description: "${p.description}"`,
    answered.length ? `Answers so far:\n${answered.join('\n')}` : 'No questions answered yet.',
  ].join('\n\n')
}

/* ────────────────────────────── clarify ────────────────────────────── */

const QUESTION_SYSTEM = [
  'You run a short scaffolding interview. Ask ONLY questions whose answer would change',
  'what gets built — never preference trivia, never anything you can sensibly default.',
  'Respond with ONLY JSON: {"done":false,"question":"...","why":"...","options":["...","..."],"shapes":"AUTH"}',
  'question: one plain sentence. why: one sentence starting with what it changes.',
  'options: 2-4 concrete answers, the most likely one first. shapes: ONE uppercase word',
  'naming what the answer decides (AUTH, STORAGE, SCALE, APPROVALS, HOSTING, NOTIFY).',
  'After three to five useful questions, or when nothing material is unknown, return {"done":true}.',
].join(' ')

/** The local question bank: enough to run the flow with no key. */
const FALLBACK_QUESTIONS: Question[] = [
  {
    question: 'Who signs in?',
    why: 'It decides the whole authentication model and who can see what.',
    options: ['Invited people only', 'Anyone with the link', 'Public with accounts'],
    shapes: 'AUTH',
  },
  {
    question: 'Roughly what scale?',
    why: 'It changes the storage and hosting tier the plan commits to.',
    options: ['A handful of users', 'Tens of users', 'Hundreds or more'],
    shapes: 'SCALE',
  },
  {
    question: 'Does anything here need a formal record?',
    why: 'An audit trail adds tables and an archive — worth it only if it settles disputes.',
    options: ['Yes, a formal record', 'No, informal is fine'],
    shapes: 'APPROVALS',
  },
]

export async function nextQuestion(
  client: ModelClient | null,
  project: Project,
): Promise<Question | null> {
  if (client === null) {
    return FALLBACK_QUESTIONS[project.answers.length] ?? null
  }
  const raw = await client.complete({
    system: QUESTION_SYSTEM,
    user: context(project),
    maxTokens: 900,
    json: true,
  })
  const p = parseJson(raw)
  if (p.done === true) return null
  const options = (Array.isArray(p.options) ? p.options : [])
    .filter((o): o is string => typeof o === 'string' && o.trim() !== '')
    .slice(0, 4)
  if (options.length < 2 || str(p.question) === '') {
    throw new AiError('Model output had the wrong shape.', true)
  }
  return {
    question: str(p.question),
    why: str(p.why, 'It changes what gets built.'),
    options,
    shapes: str(p.shapes, 'SCOPE').toUpperCase(),
  }
}

/* ─────────────────────────── capability check ──────────────────────── */

const CAPABILITY_SYSTEM = [
  'You check a project description against what a coding agent swarm can actually build,',
  'BEFORE any work starts. Respond with ONLY JSON:',
  '{"checked":34,"ready":["..."],"needsSetup":[{"name":"...","minutes":10,"detail":"..."}],',
  '"outOfScope":[{"name":"...","instead":"..."}]}',
  'ready: 5-8 concrete capabilities this project needs that are straightforwardly buildable.',
  'needsSetup: things needing an account, domain, or credential from the user — with minutes.',
  'outOfScope: things genuinely not buildable, each with a concrete "instead" alternative.',
  'Be specific to THIS project. Never invent limits that do not apply to it.',
].join(' ')

function fallbackCapability(p: Project): CapabilityReport {
  const wantsAuth = p.answers.some((a) => a.shaped === 'AUTH')
  return {
    checked: 34,
    ready: [
      'Core data model and persistence',
      'Web UI with responsive layout',
      wantsAuth ? 'Email invitations and magic-link sign-in' : 'Session handling',
      'File upload and previews',
      'Search and filtering',
      'Activity history',
    ],
    needsSetup: [
      {
        name: 'Custom domain',
        minutes: 10,
        detail: 'You add one DNS record — exact steps provided at handoff.',
      },
    ],
    outOfScope: [
      {
        name: 'Native mobile push notifications',
        instead: 'Email digests plus web notifications. Extension point left in the code.',
      },
    ],
  }
}

export async function checkCapabilities(
  client: ModelClient | null,
  project: Project,
): Promise<CapabilityReport> {
  if (client === null) return fallbackCapability(project)
  const raw = await client.complete({
    system: CAPABILITY_SYSTEM,
    user: context(project),
    maxTokens: 1800,
    json: true,
  })
  const p = parseJson(raw)
  const ready = (Array.isArray(p.ready) ? p.ready : [])
    .filter((x): x is string => typeof x === 'string')
    .slice(0, 12)
  if (ready.length === 0) throw new AiError('Model output had the wrong shape.', true)
  const needsSetup = (Array.isArray(p.needsSetup) ? p.needsSetup : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      name: str(x.name, 'Setup step'),
      minutes: typeof x.minutes === 'number' ? x.minutes : 10,
      detail: str(x.detail, 'Configuration you provide.'),
    }))
    .slice(0, 5)
  const outOfScope = (Array.isArray(p.outOfScope) ? p.outOfScope : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({ name: str(x.name, 'Not buildable'), instead: str(x.instead, 'No alternative.') }))
    .slice(0, 5)
  return {
    checked: typeof p.checked === 'number' ? p.checked : ready.length + needsSetup.length + outOfScope.length,
    ready,
    needsSetup,
    outOfScope,
  }
}

/* ───────────────────────────── decisions ───────────────────────────── */

const DECISIONS_SYSTEM = [
  'You present the decisions that are genuinely the user\'s to make — real tradeoffs, not',
  'questions with an obvious answer. Respond with ONLY JSON: {"decisions":[{"topic":"sign-in",',
  '"question":"...","options":[{"label":"...","rationale":"...","status":"ready","recommended":true}]}]}',
  'Two or three decisions maximum. Each option: status "ready" or "needs-setup", exactly one',
  'recommended per decision, rationale one sentence tied to what the user actually said.',
].join(' ')

function fallbackDecisions(p: Project): Decision[] {
  const limit = p.capability?.outOfScope[0]
  return [
    {
      id: hex(`d:${p.id}:signin`),
      topic: 'sign-in',
      question: 'How should people sign in?',
      options: [
        {
          label: 'Magic-link email',
          rationale: 'Infrequent sign-ins, and it removes forgotten-password support entirely.',
          status: 'ready',
          recommended: true,
        },
        {
          label: 'Google sign-in',
          rationale: 'One click and familiar, but you must register an OAuth app first.',
          status: 'needs-setup',
          recommended: false,
        },
        {
          label: 'Password accounts',
          rationale: 'Self-contained, but adds reset flows and friction.',
          status: 'ready',
          recommended: false,
        },
      ],
      chosen: null,
      limitNote: limit ? `Known limit, flagged at step 3: no ${limit.name.toLowerCase()}.` : null,
    },
    {
      id: hex(`d:${p.id}:hosting`),
      topic: 'hosting',
      question: 'Where should this run?',
      options: [
        {
          label: 'Hosted for you',
          rationale: 'Nothing to operate; a custom domain needs one DNS record from you.',
          status: 'needs-setup',
          recommended: true,
        },
        {
          label: 'Your own infrastructure',
          rationale: 'Full control, but you own upgrades and uptime.',
          status: 'ready',
          recommended: false,
        },
      ],
      chosen: null,
      limitNote: null,
    },
  ]
}

export async function proposeDecisions(
  client: ModelClient | null,
  project: Project,
): Promise<Decision[]> {
  if (client === null) return fallbackDecisions(project)
  const raw = await client.complete({
    system: DECISIONS_SYSTEM,
    user: context(project),
    maxTokens: 1800,
    json: true,
  })
  const p = parseJson(raw)
  const list = Array.isArray(p.decisions) ? p.decisions : []
  const decisions: Decision[] = list
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map((d, i) => {
      const options = (Array.isArray(d.options) ? d.options : [])
        .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
        .map((o) => ({
          label: str(o.label, 'Option'),
          rationale: str(o.rationale, ''),
          status: o.status === 'needs-setup' ? ('needs-setup' as const) : ('ready' as const),
          recommended: o.recommended === true,
        }))
        .slice(0, 4)
      return {
        id: hex(`d:${project.id}:${i}:${str(d.topic, String(i))}`),
        topic: str(d.topic, `decision ${i + 1}`),
        question: str(d.question, 'Which approach?'),
        options,
        chosen: null,
        limitNote: null,
      }
    })
    .filter((d) => d.options.length >= 2)
  if (decisions.length === 0) throw new AiError('Model output had the wrong shape.', true)
  return decisions
}

/* ─────────────────────────── plan and tasks ────────────────────────── */

/**
 * The spec is assembled locally even when a model is available: every section
 * must trace to a specific answer or decision, and building it from the
 * project state is what makes that traceability true rather than claimed.
 */
export function buildPlan(p: Project): { spec: SpecSection[]; tasks: Task[] } {
  const spec: SpecSection[] = []
  const push = (title: string, body: string, traces: string[]) =>
    spec.push({ id: `§${spec.length + 1}`, title, body, traces })

  push('Scope', p.description, ['step 1 · your description'])

  for (const a of p.answers) {
    push(titleFor(a.shaped), `${a.question} — ${a.answer}`, [`step 2 · ${a.question}`])
  }
  for (const d of p.decisions) {
    if (d.chosen === null) continue
    push(titleFor(d.topic.toUpperCase()), `${d.question} — ${d.chosen}`, [`step 4 · ${d.topic}`])
  }
  const out = p.capability?.outOfScope ?? []
  if (out.length > 0) {
    push(
      'Known limits',
      out.map((o) => `${o.name} — instead: ${o.instead}`).join(' '),
      ['step 3 · capability check'],
    )
  }
  const setup = p.capability?.needsSetup ?? []
  if (setup.length > 0) {
    push(
      'Your tasks',
      setup.map((s) => `${s.name} (~${s.minutes} min): ${s.detail}`).join(' '),
      ['step 3 · capability check'],
    )
  }

  const sectionIds = spec.map((s) => s.id)
  const pick = (i: number) => sectionIds[Math.min(i, sectionIds.length - 1)]
  const names: { phase: 'A' | 'B' | 'C'; name: string }[] = [
    { phase: 'A', name: 'Scaffold repository' },
    { phase: 'A', name: 'Database schema' },
    { phase: 'A', name: 'Authentication' },
    { phase: 'B', name: 'Core features' },
    { phase: 'B', name: 'Upload pipeline' },
    { phase: 'B', name: 'Records and history' },
    { phase: 'C', name: 'Notifications' },
    { phase: 'C', name: 'Deploy and domain' },
    { phase: 'C', name: 'Runbook and docs' },
  ]
  const tasks: Task[] = names.map((t, i) => ({
    id: hex(`t:${p.id}:${i}`),
    phase: t.phase,
    name: t.name,
    section: pick(i),
    status: 'queued',
    progress: 0,
  }))
  return { spec, tasks }
}

function titleFor(shaped: string): string {
  const map: Record<string, string> = {
    AUTH: 'Sign-in',
    STORAGE: 'Storage',
    SCALE: 'Scale',
    APPROVALS: 'Approvals',
    HOSTING: 'Deploy',
    NOTIFY: 'Notifications',
    'SIGN-IN': 'Sign-in',
  }
  return map[shaped] ?? shaped.charAt(0) + shaped.slice(1).toLowerCase()
}

/* ───────────────────────────── copilot ─────────────────────────────── */

const COPILOT_SYSTEM = [
  'You are a copilot beside a project-scaffolding flow. Give ONE short paragraph of advice',
  'about the current step: what you recommend, WHY, and what would change your mind.',
  'Never a bare instruction. No preamble, no markdown. Two or three sentences.',
].join(' ')

export async function copilotSay(
  client: ModelClient | null,
  project: Project,
  situation: string,
  fallback: string,
): Promise<string> {
  if (client === null) return fallback
  try {
    const raw = await client.complete({
      system: COPILOT_SYSTEM,
      user: `${context(project)}\n\nCurrent step: ${situation}`,
      maxTokens: 300,
    })
    const text = raw.trim()
    return text === '' ? fallback : text
  } catch {
    return fallback
  }
}
