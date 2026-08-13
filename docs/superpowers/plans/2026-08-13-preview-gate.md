# Preview Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blind "Finish & polish" exit with a preview gate — polished prompt stacked on an outcome sketch whose forced assumptions become pin-this-down question chips; Copy exists only on the preview.

**Architecture:** Two new pure-ish core functions in `src/core/interview.ts` (`sketchOutcome`, `chipToProposal`), both through the injected `ModelClient` with `proposeNext`-style shape checking. One new presentational component (`PreviewPanel`). All async and state stay in `App.tsx`; the preview is ephemeral state invalidated by the existing `commit()`.

**Tech Stack:** React 19, TypeScript 7, vitest 4 + jsdom (raw `createRoot`+`act` pattern — NOT @testing-library), `@anthropic-ai/sdk` via the existing `ModelClient`.

## Global Constraints

- Proposals/previews are staged; **only user acceptance mutates the `Brief`** (spec: a malformed response can never corrupt state).
- **The artifact the user approves is byte-for-byte the artifact that ships** — Copy copies exactly the previewed `polished` string.
- Preview is **ephemeral UI state, NOT persisted**; valid iff `preview.briefUpdatedAt === brief.updatedAt`.
- Guesses cap at **5**; malformed/missing `guesses` degrades to `[]`, never fails the preview.
- Exactly **ONE copy affordance**: the "Looks right — Copy" primary action on the preview panel.
- Errors use the existing `AiError` taxonomy; degraded paths per spec (polish fails → raw draft labeled; sketch fails → prompt-only preview; no key → raw draft, same gate).
- Tests: `npx vitest run` green at every commit; build: `npm run build`.

---

### Task 1: `sketchOutcome` + `Guess` type

**Files:**
- Modify: `src/core/interview.ts` (append after `polish`)
- Test: `src/core/interview.test.ts` (append describe block)

**Interfaces:**
- Consumes: `ModelClient`, `Brief`, `briefContext()`, `AiError`, `hexId`-style ids via `djb2` from `./rng`
- Produces: `interface Guess { id: string; topic: string; assumption: string }`, `sketchOutcome(client: ModelClient, brief: Brief): Promise<{ outcome: string; guesses: Guess[] }>`

- [ ] **Step 1: Write the failing test** — append to `src/core/interview.test.ts`:

```ts
describe('sketchOutcome', () => {
  const GOOD_SKETCH = JSON.stringify({
    outcome: 'A single-page app with a watering dashboard. It will not include camera ID.',
    guesses: [
      { topic: 'Data storage', assumption: 'plant list kept in localStorage' },
      { topic: 'Reminders', assumption: 'no notifications, dashboard only' },
    ],
  })

  it('parses outcome and guesses, assigning stable ids', async () => {
    const r = await sketchOutcome(stub(GOOD_SKETCH), createBrief('plants', T0))
    expect(r.outcome).toContain('watering dashboard')
    expect(r.guesses).toHaveLength(2)
    expect(r.guesses[0].id).toMatch(/^[0-9A-F]+$/)
    expect(r.guesses[0].topic).toBe('Data storage')
    expect(r.guesses[0].id).not.toBe(r.guesses[1].id)
  })

  it('truncates guesses to five', async () => {
    const many = JSON.stringify({
      outcome: 'ok',
      guesses: Array.from({ length: 8 }, (_, i) => ({ topic: `t${i}`, assumption: `a${i}` })),
    })
    const r = await sketchOutcome(stub(many), createBrief('x', T0))
    expect(r.guesses).toHaveLength(5)
  })

  it('degrades missing or malformed guesses to an empty list', async () => {
    const noGuesses = JSON.stringify({ outcome: 'still useful' })
    expect((await sketchOutcome(stub(noGuesses), createBrief('x', T0))).guesses).toEqual([])
    const badGuesses = JSON.stringify({ outcome: 'ok', guesses: [{ topic: 42 }, 'nope'] })
    expect((await sketchOutcome(stub(badGuesses), createBrief('x', T0))).guesses).toEqual([])
  })

  it('rejects an empty or missing outcome as AiError', async () => {
    await expect(
      sketchOutcome(stub(JSON.stringify({ outcome: '  ', guesses: [] })), createBrief('x', T0)),
    ).rejects.toBeInstanceOf(AiError)
    await expect(sketchOutcome(stub('not json'), createBrief('x', T0))).rejects.toBeInstanceOf(
      AiError,
    )
  })

  it('tolerates a markdown-fenced payload', async () => {
    const fenced = '```json\n' + GOOD_SKETCH + '\n```'
    expect((await sketchOutcome(stub(fenced), createBrief('x', T0))).guesses).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/core/interview.test.ts` → FAIL: `sketchOutcome` not exported.

- [ ] **Step 3: Implement** — append to `src/core/interview.ts`:

```ts
export interface Guess {
  id: string
  topic: string
  assumption: string
}

const SKETCH_SYSTEM = [
  'You predict what a coding agent handed this prompt would actually build.',
  'Respond with ONLY JSON: {"outcome":"...","guesses":[{"topic":"...","assumption":"..."}]}.',
  'outcome: 3-6 sentences, concrete — name the screens/surfaces, the core behaviors,',
  'and end with what it will NOT include. No hedging, no "probably".',
  'guesses: 0-5 assumptions you had to INVENT because the prompt does not specify them,',
  'ONLY ones that would change what gets built — skip cosmetics. topic is 1-3 words;',
  'assumption is the concrete choice you made.',
].join(' ')

function stripFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\n?|\n?```$/g, '')
}

export async function sketchOutcome(
  client: ModelClient,
  brief: Brief,
): Promise<{ outcome: string; guesses: Guess[] }> {
  const raw = await client.complete({
    system: SKETCH_SYSTEM,
    user: briefContext(brief),
    maxTokens: 1500,
    json: true,
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(raw))
  } catch {
    throw new AiError('Model returned unparseable output.', true)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new AiError('Model output had the wrong shape.', true)
  }
  const p = parsed as Record<string, unknown>
  if (typeof p.outcome !== 'string' || p.outcome.trim() === '') {
    throw new AiError('Model output had the wrong shape.', true)
  }
  // Chips are a bonus; a sketch without them is still a useful preview.
  const guesses: Guess[] = (Array.isArray(p.guesses) ? p.guesses : [])
    .filter(
      (g): g is { topic: string; assumption: string } =>
        !!g &&
        typeof g === 'object' &&
        typeof (g as Record<string, unknown>).topic === 'string' &&
        typeof (g as Record<string, unknown>).assumption === 'string' &&
        (g as Record<string, unknown>).topic !== '' &&
        (g as Record<string, unknown>).assumption !== '',
    )
    .slice(0, 5)
    .map((g) => ({
      id: (djb2(`guess:${g.topic}:${g.assumption}`) >>> 0).toString(16).toUpperCase(),
      topic: g.topic,
      assumption: g.assumption,
    }))
  const allValid = Array.isArray(p.guesses)
    ? p.guesses.length === 0 || guesses.length > 0
    : true
  return { outcome: p.outcome.trim(), guesses: allValid ? guesses : [] }
}
```

Also add `import { djb2 } from './rng'` at the top of `interview.ts`, and refactor `proposeNext`'s inline fence-strip to use `stripFence` (same regex, defined once).

NOTE on the degraded-to-`[]` rule: when the guesses array exists but every entry is malformed, return `[]` (the `allValid` guard covers the mixed case in the test: `[{topic: 42}, 'nope']` filters to 0 valid → `[]`).

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/core/interview.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add src/core/interview.ts src/core/interview.test.ts && git commit -m "feat(core): sketchOutcome — outcome prose + forced-assumption guesses"`

---

### Task 2: `chipToProposal`

**Files:**
- Modify: `src/core/interview.ts` (append)
- Test: `src/core/interview.test.ts` (append)

**Interfaces:**
- Consumes: `Guess` (Task 1), `Proposal` from `./brief`, `briefContext`, validation logic shape from `proposeNext`
- Produces: `chipToProposal(client: ModelClient, brief: Brief, guess: Guess): Promise<Proposal>`

- [ ] **Step 1: Write the failing test:**

```ts
describe('chipToProposal', () => {
  const guess = { id: 'A1', topic: 'Data storage', assumption: 'kept in localStorage' }
  const GOOD_CHIP = JSON.stringify({
    kind: 'inputs',
    label: 'Data Storage',
    question: 'Where should the plant list live?',
    options: ['kept in localStorage', 'a JSON file I export', 'a tiny backend'],
  })

  it('returns a valid Proposal with the assumption as first option', async () => {
    const p = await chipToProposal(stub(GOOD_CHIP), createBrief('plants', T0), guess)
    expect(p.options[0]).toBe('kept in localStorage')
    expect(p.kind).toBe('inputs')
  })

  it('forces the assumption to first position if the model buried it', async () => {
    const buried = JSON.stringify({
      kind: 'inputs',
      label: 'Data Storage',
      question: 'Where?',
      options: ['a tiny backend', 'kept in localStorage'],
    })
    const p = await chipToProposal(stub(buried), createBrief('x', T0), guess)
    expect(p.options[0]).toBe('kept in localStorage')
  })

  it('prepends the assumption when the model omitted it entirely', async () => {
    const missing = JSON.stringify({
      kind: 'inputs',
      label: 'Data Storage',
      question: 'Where?',
      options: ['a backend', 'a JSON file'],
    })
    const p = await chipToProposal(stub(missing), createBrief('x', T0), guess)
    expect(p.options[0]).toBe('kept in localStorage')
    expect(p.options).toHaveLength(3)
  })

  it('rejects malformed payloads as AiError', async () => {
    await expect(
      chipToProposal(stub('null'), createBrief('x', T0), guess),
    ).rejects.toBeInstanceOf(AiError)
  })
})
```

- [ ] **Step 2: Run to verify failure** — FAIL: `chipToProposal` not exported.

- [ ] **Step 3: Implement** — refactor `proposeNext`'s validation body into a shared `parseProposal(raw: string): Proposal | null` (returns null for `{done:true}`, throws `AiError` otherwise-invalid — exactly the current logic), then:

```ts
const CHIP_SYSTEM = [
  'A prompt-preview had to assume something the prompt does not specify.',
  'Write ONE interview question that pins it down.',
  'Respond with ONLY JSON {"kind":...,"label":...,"question":...,"options":[...]} —',
  `kind one of: ${KINDS.join(', ')}; label 1-2 words; question one plain sentence;`,
  'options 2-4 short concrete answers. The FIRST option must be the assumption',
  'exactly as given (confirming the default), alternatives after it.',
].join(' ')

export async function chipToProposal(
  client: ModelClient,
  brief: Brief,
  guess: Guess,
): Promise<Proposal> {
  const raw = await client.complete({
    system: CHIP_SYSTEM,
    user: `${briefContext(brief)}\n\nTopic: ${guess.topic}\nAssumption made: ${guess.assumption}`,
    maxTokens: 800,
    json: true,
  })
  const proposal = parseProposal(raw)
  if (proposal === null) {
    throw new AiError('Model output had the wrong shape.', true)
  }
  // The assumption is the recommended option; force it to the front so
  // accepting the default always means confirming the guess.
  const rest = proposal.options.filter((o) => o !== guess.assumption)
  return { ...proposal, options: [guess.assumption, ...rest].slice(0, 4) }
}
```

- [ ] **Step 4: Run to verify pass** — full `npx vitest run` (the `parseProposal` refactor touches `proposeNext`'s tests too) → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(core): chipToProposal — pin-this-down chips become interview questions"`

---

### Task 3: `PreviewPanel` component

**Files:**
- Create: `src/ui/PreviewPanel.tsx`
- Modify: `src/styles/app.css` (append)
- Test: `src/ui/PreviewPanel.test.tsx`

**Interfaces:**
- Consumes: `Guess` from `../core/interview`
- Produces: `PreviewPanel` with props `{ polished: string; outcome: string | null; guesses: Guess[]; note: string | null; onCopy: () => void; onBack: () => void; onPin: (g: Guess) => void; copied: boolean }`

- [ ] **Step 1: Write the failing test** (createRoot+act pattern, as in `BoardView.test.tsx`):

```tsx
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PreviewPanel from './PreviewPanel'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const guesses = [
  { id: 'A1', topic: 'Data storage', assumption: 'localStorage' },
  { id: 'B2', topic: 'Reminders', assumption: 'none' },
]
const base = {
  polished: 'Build the plant app.',
  outcome: 'One dashboard screen. It will not include camera ID.',
  guesses,
  note: null as string | null,
  onCopy: () => {},
  onBack: () => {},
  onPin: (_g: (typeof guesses)[0]) => {},
  copied: false,
}

function mount(over: Partial<typeof base> = {}) {
  act(() => {
    root = createRoot(container)
    root.render(<PreviewPanel {...base} {...over} />)
  })
}
function button(label: string): HTMLButtonElement {
  const b = Array.from(container.querySelectorAll('button')).find((x) =>
    (x.textContent ?? '').toLowerCase().includes(label.toLowerCase()),
  )
  if (!b) throw new Error(`button ${label} not found`)
  return b
}
function click(el: Element) {
  act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

describe('PreviewPanel', () => {
  it('renders prompt, outcome, and one chip per guess', () => {
    mount()
    expect(container.textContent).toContain('Build the plant app.')
    expect(container.textContent).toContain('One dashboard screen')
    expect(container.querySelectorAll('[data-testid="guess-chip"]')).toHaveLength(2)
  })

  it('has exactly one copy affordance and fires onCopy', () => {
    const onCopy = vi.fn()
    mount({ onCopy })
    const copies = Array.from(container.querySelectorAll('button')).filter((b) =>
      (b.textContent ?? '').toLowerCase().includes('copy'),
    )
    expect(copies).toHaveLength(1)
    click(copies[0])
    expect(onCopy).toHaveBeenCalledOnce()
  })

  it('fires onPin with the clicked guess', () => {
    const onPin = vi.fn()
    mount({ onPin })
    click(container.querySelectorAll('[data-testid="guess-chip"]')[1])
    expect(onPin).toHaveBeenCalledWith(guesses[1])
  })

  it('renders without outcome (degraded sketch) and shows the note', () => {
    mount({ outcome: null, guesses: [], note: 'Sketch unavailable.' })
    expect(container.textContent).toContain('Sketch unavailable.')
    expect(container.textContent).toContain('Build the plant app.')
  })

  it('shows copied state', () => {
    mount({ copied: true })
    expect(button('copied').textContent).toContain('Copied')
  })

  it('fires onBack', () => {
    const onBack = vi.fn()
    mount({ onBack })
    click(button('back to the board'))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run to verify failure** — FAIL: cannot resolve `./PreviewPanel`.

- [ ] **Step 3: Implement:**

```tsx
// src/ui/PreviewPanel.tsx
import type { Guess } from '../core/interview'

interface Props {
  polished: string
  /** null = sketch unavailable (degraded); prompt-only preview. */
  outcome: string | null
  guesses: Guess[]
  note: string | null
  onCopy: () => void
  onBack: () => void
  onPin: (g: Guess) => void
  copied: boolean
}

/**
 * The preview gate: what you're about to copy, stacked on what it would
 * build. Copy lives HERE and nowhere else — approving the preview and
 * copying are the same act, and the copied text is exactly the text shown.
 */
export default function PreviewPanel({
  polished,
  outcome,
  guesses,
  note,
  onCopy,
  onBack,
  onPin,
  copied,
}: Props) {
  return (
    <section className="preview-panel" data-testid="preview">
      {note && <p className="ai-note">{note}</p>}

      <div className="draft-panel">
        <span className="label">Your prompt</span>
        <p className="draft" data-testid="preview-prompt">{polished}</p>
      </div>

      {outcome !== null && (
        <div className="outcome-panel">
          <span className="label">What you'd get</span>
          <p className="draft" data-testid="preview-outcome">{outcome}</p>
        </div>
      )}

      {guesses.length > 0 && (
        <div className="guess-row">
          <span className="label">The sketch had to guess — pin these down?</span>
          <div className="guess-chips">
            {guesses.map((g) => (
              <button
                key={g.id}
                type="button"
                className="action-btn guess-chip"
                data-testid="guess-chip"
                onClick={() => onPin(g)}
              >
                {g.topic}: {g.assumption}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="preview-actions">
        <button type="button" className="action-btn finish-btn" onClick={onCopy}>
          {copied ? 'Copied!' : 'Looks right — Copy'}
        </button>
        <button type="button" className="action-btn" onClick={onBack}>
          Back to the board
        </button>
      </div>
    </section>
  )
}
```

CSS append to `src/styles/app.css`:

```css
/* --- preview gate --- */
.preview-panel { display: flex; flex-direction: column; gap: var(--space-3);
  align-self: stretch; width: 100%; max-width: 46rem; margin-inline: auto; }
.outcome-panel { background: var(--color-surface); border: 1px dashed var(--color-accent);
  border-radius: var(--radius-md); padding: var(--space-4); }
.guess-row { display: flex; flex-direction: column; gap: var(--space-2); }
.guess-chips { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.guess-chip { font-size: var(--text-sm); }
.preview-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/ui/PreviewPanel.test.tsx` → PASS (6 tests).

- [ ] **Step 5: Commit** — `git commit -m "feat(ui): PreviewPanel — stacked prompt + outcome, guess chips, single Copy"`

---

### Task 4: Wire the gate into App

**Files:**
- Modify: `src/ui/App.tsx` (replace `polished` state + `handleFinish` + polished-panel JSX; add preview state, copy, pin handler)
- Modify: `src/ui/BoardView.tsx` (Finish button label only)
- Test: `src/ui/interviewFlow.test.tsx` (replace the stale-polish test; add gate tests)

**Interfaces:**
- Consumes: everything from Tasks 1–3; existing `commit()`, `ticket`, `templateSentence`, `renderDraft`
- Produces: `Preview` state type `{ polished: string; outcome: string | null; guesses: Guess[]; briefUpdatedAt: number }`

- [ ] **Step 1: Update tests.** In `interviewFlow.test.tsx`, replace the `'editing after a polish drops the now-stale polished text'` test and add the gate contract (no-key path — `finish` label changed):

```tsx
  it('preview gate: Copy exists only on the preview, and mutations drop it', () => {
    mount()
    type(seedInput(), 'a leftovers app')
    click(button('start'))
    // No copy affordance anywhere before previewing:
    expect(
      Array.from(container.querySelectorAll('button')).some((b) =>
        (b.textContent ?? '').toLowerCase().includes('copy'),
      ),
    ).toBe(false)
    click(button('preview what'))
    expect(container.querySelector('[data-testid="preview"]')).toBeTruthy()
    expect(button('looks right')).toBeTruthy()
    // No-key path: prompt slot holds the raw draft, no outcome, no chips:
    expect(container.querySelector('[data-testid="preview-prompt"]')?.textContent).toContain(
      'a leftovers app',
    )
    expect(container.querySelector('[data-testid="preview-outcome"]')).toBeNull()
    // Mutation drops the preview and its Copy:
    click(button('add a block'))
    const inputs = container.querySelectorAll<HTMLInputElement>('.add-block input')
    type(inputs[0], 'Budget')
    type(inputs[1], 'cheap')
    click(button('^add$'))
    expect(container.querySelector('[data-testid="preview"]')).toBeNull()
  })

  it('copy puts exactly the previewed text on the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mount()
    type(seedInput(), 'a leftovers app')
    click(button('start'))
    click(button('preview what'))
    const shown = container.querySelector('[data-testid="preview-prompt"]')?.textContent
    click(button('looks right'))
    await act(async () => {})
    expect(writeText).toHaveBeenCalledWith(shown)
  })
```

(`button()` helper already matches by substring; change it to support the `^add$` exact form used above, or match 'Add' by exact text — implementer's choice, shown in Step 3.)

- [ ] **Step 2: Run to verify failure** — the two new tests FAIL (`preview what` button absent; old `finish` flow still present). The replaced stale-polish test is gone.

- [ ] **Step 3: Implement in `App.tsx`.** Replace `const [polished, setPolished] = useState<string | null>(null)` with:

```tsx
  interface PreviewState {
    polished: string
    outcome: string | null
    guesses: Guess[]
    briefUpdatedAt: number
  }
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [copied, setCopied] = useState(false)
```

`commit()` sets `setPreview(null)` (was `setPolished(null)`). `handleStartOver` likewise. Replace `handleFinish`:

```tsx
  async function handleFinish() {
    if (!brief) return
    const mine = ++ticket.current
    if (client === null) {
      setPreview({ polished: draft, outcome: null, guesses: [], briefUpdatedAt: brief.updatedAt })
      return
    }
    setLoading(true)
    setNote(null)
    // Polish and sketch are independent — run them together; each degrades alone.
    const [polishR, sketchR] = await Promise.allSettled([
      polish(client, draft),
      sketchOutcome(client, brief),
    ])
    if (mine !== ticket.current) return
    const polished = polishR.status === 'fulfilled' ? polishR.value : draft
    const outcome = sketchR.status === 'fulfilled' ? sketchR.value.outcome : null
    const guesses = sketchR.status === 'fulfilled' ? sketchR.value.guesses : []
    if (polishR.status === 'rejected' && sketchR.status === 'rejected') {
      setNote('Preview generation failed — showing the raw draft.')
    } else if (polishR.status === 'rejected') {
      setNote('Polish unavailable — this is the unpolished draft.')
    } else if (sketchR.status === 'rejected') {
      setNote('Outcome sketch unavailable.')
    }
    setPreview({ polished, outcome, guesses, briefUpdatedAt: brief.updatedAt })
    setLoading(false)
  }

  async function handleCopy() {
    if (!preview) return
    try {
      await navigator.clipboard?.writeText?.(preview.polished)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setNote('Copy failed — select the text manually.')
    }
  }

  async function handlePin(guess: Guess) {
    if (!brief || client === null) return
    const mine = ++ticket.current
    setLoading(true)
    try {
      const p = await chipToProposal(client, brief, guess)
      if (mine !== ticket.current) return
      setProposal(p)
      setPreview(null) // pinning re-opens the interview; the preview is now provisional
    } catch (e) {
      if (mine !== ticket.current) return
      const err = e instanceof AiError ? e : new AiError('Unexpected error.', true)
      setNote(err.message)
    } finally {
      if (mine === ticket.current) setLoading(false)
    }
  }
```

JSX: replace the `polished !== null && …polished-panel…` block with:

```tsx
              {preview !== null && preview.briefUpdatedAt === brief.updatedAt && (
                <PreviewPanel
                  polished={preview.polished}
                  outcome={preview.outcome}
                  guesses={preview.guesses}
                  note={note}
                  copied={copied}
                  onCopy={handleCopy}
                  onBack={() => setPreview(null)}
                  onPin={handlePin}
                />
              )}
```

Imports: add `chipToProposal, sketchOutcome, type Guess` to the `../core/interview` import; add `PreviewPanel from './PreviewPanel'`; drop nothing else. In `BoardView.tsx` change the finish button text to `Preview what you'll get`.

DESIGN NOTE — spec deviation, intentional: the spec says chip-click keeps the preview alive until the block is accepted. But a staged proposal renders on the *board*, and leaving a now-provisional preview up while the user answers creates the two-contradictory-artifacts problem the gate exists to prevent. `handlePin` therefore drops the preview when the proposal stages. Record this in the commit message.

- [ ] **Step 4: Run full suite** — `npx vitest run` → PASS; `npm run build` → green.

- [ ] **Step 5: Commit** — `git commit -m "feat(ui): wire the preview gate — Finish previews, Copy gates, chips re-open the interview"`

---

### Task 5: Final verification

- [ ] **Step 1:** `npx vitest run` → all green; `npm run build` → exit 0.
- [ ] **Step 2:** Browser smoke (preview_start `prompt-spark`, no API key): Start an idea → add a block → "Preview what you'll get" → panel shows raw draft, no outcome, single Copy → Copy shows Copied! → edit the block → panel gone → re-preview → panel back.
- [ ] **Step 3:** Commit any fixes found.

---

## Self-Review

**Spec coverage:** stacked preview → T1+T4; guesses→chips → T1+T2+T3; assumption-first recommended option → T2; single Copy affordance, byte-exact → T3+T4; ephemeral + `briefUpdatedAt` staleness → T4; commit() invalidation → T4 (already existed); degraded paths (polish/sketch/no-key) → T4 `Promise.allSettled` + tests; guesses cap 5 + degrade-to-[] → T1; AiError reuse → T1+T2. Gap: none found. One recorded deviation (chip click drops preview immediately) with rationale in T4.

**Placeholders:** none — every step has code.

**Type consistency:** `Guess` defined once in interview.ts (T1), consumed by T2/T3/T4; `PreviewPanel` props (T3) match T4's call site; `parseProposal` refactor (T2) keeps `proposeNext` behavior.
