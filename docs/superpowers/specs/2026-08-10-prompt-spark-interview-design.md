# Prompt Spark → interview-to-prompt board

**Date:** 2026-08-10
**Status:** design approved, spec pending review
**Supersedes:** the subject-pack generator premise from the v0.1-overnight run

## Problem

Prompt Spark generates prompts, but `/brainstorming` is more useful. Two reasons, given
directly by the user:

1. **No back-and-forth.** The app is one-shot at every layer. `aiGenerate(seed, filters)`
   returns one prompt; `aiScout(phrase, seed)` returns four rungs and three remixes. Both are
   single API calls that emit output and stop. Turning on AI mode improved the *text* without
   changing the *shape*.
2. **The writing is bland.** 48 templates plus a twist list produce interchangeable prose.

These are one problem, not two: a generator that knows nothing about you has to write
generically. Dialogue is what earns the app the right to be specific.

## What was scouted

Twelve `gh` queries across four vocabularies (`prompt optimizer`/`builder`, `interactive prompt
refinement`, `socratic`/`interview`, `prompt clarifying questions`), two `--topic` indexes
(`prompt-engineering`, `brainstorming`), a WebSearch, an npm registry sweep, and an awesome-list
check. Finalists were grep-verified against their READMEs; nothing entered the table on
description alone.

| Repo | ★ | Last push | License | Fit | Escape hatch |
|---|---|---|---|---|---|
| linshenkx/prompt-optimizer | 33,035 | 2026-07-25 | AGPL-3.0-only | Mirror image — polishes a prompt you bring. Its only "multi-turn" is conversation *testing*. Never asks the user anything. | trapped |
| O-K1ng0/PromptAlloy | 0 | 2026-06-04 | NOASSERTION | Closest behavior; asks 8–12 clarifying questions in one batch, not one at a time. Python/Flask. | vendorable |
| TimYuann/Talk-like-a-pro | 7 | 2026-08-04 | MIT | Right mechanism, wrong host — a Pi agent extension whose input model is "explore the project context". Good tiered output specs. | vendorable |
| Optim-Agent/optim-plans | 455 | 2026-08-09 | MIT | The discipline, not the product: "ask one planning question at a time, recommended option first, `Other` second-last". A Claude Code / Codex plugin. | vendorable |

Dropped on the license axis: `prompt-polish-studio` (0★, no license, README is unmodified CRA
boilerplate), `grillme-skill` (31★, no license). `mitchlabeetch/PromptHelper`, recommended by
WebSearch as an exact match, 404s.

**Finding: no adoptable prior art.** The category splits and this project falls in the crack —
every healthy implementation of the interview is a coding-agent plugin, and every browser
implementation is a one-shot optimizer. The four browser tools that do interview are 0★, 0★,
7★, 0★.

**Verdict: build**, vendoring ideas from the two MIT repos. Adopt fails on **Fit** (the only
candidate healthy enough to adopt does the mirror-image thing, grep-confirmed). Extend fails on
**Health and License** (the behavioral matches are 0★/NOASSERTION and 7★; after swapping
runtime, input model and output surface, no seam remains — only prose).

Vendored, with attribution, both MIT:
- `optim-plans` — one question at a time; recommended option first, `Other` second-last.
- `Talk-like-a-pro` — tiered output specs (intent, requirements, boundaries, acceptance).

## Product shape

A focused single-purpose tab. One rough idea in, one sharp prompt out, via an interview whose
state is a **board of lego blocks** rather than a chat transcript.

- The draft prompt is on screen from the first question and **grows as you answer**.
- The interview *proposes* a block; you accept it, edit it, ignore it, or **add a block it never
  thought to ask about**.
- Blocks drag to reorder, `✎` edit in place, `✕` pull out.
- Copy yields **flowing prose**, not headings. Prose is what makes growth legible: a new block
  weaves into what's there, where structured output would just append another heading and read
  like a form being filled.

## Data model

```
Block = {
  id: string
  kind: 'intent' | 'whoFor' | 'hardPart' | 'inputs' | 'scope' | 'wontDo' | 'custom'
  label: string
  question: string | null      // null iff the user added this block themselves
  answer: string
  sentence: string             // LLM-written at placement, then FROZEN
}

Brief = { id, seedIdea: string, blocks: Block[], createdAt, updatedAt }
```

`Brief` is the single source of truth. The draft is a pure function of it.

## The loop

1. **Seed.** User types a rough idea. If they have none, `generate.ts` and the existing packs
   supply one — the sole surviving role of the 48 templates.
2. **Propose.** Given the `Brief`, the model returns either `{ done: true }` or one next block:
   label, question, and 2–4 options with the recommended one first, plus `Other`. Staged, not
   committed.
3. **Place.** On accept, the model writes that block's `sentence` **once**, and it is frozen
   into the `Brief`. Nothing already on screen rewords itself.
4. **Repeat** until the model returns `done: true` or the user stops. `done` is advisory — the
   user can keep adding blocks after it, and can finish before it.
5. **Confirm.** One polish pass over the whole draft. The user sees the smoothed version
   alongside the raw one and picks. Copy.

Growth is stable by construction: every visible sentence is frozen at placement, so the only
text that ever changes is text the user has just acted on, or the final polish they explicitly
approve.

## Architecture

Pure core, thin UI — the existing convention.

- `src/core/brief.ts` — `Brief`/`Block` reducer: add, edit, remove, reorder, accept, ignore.
  Pure, no network.
- `src/core/interview.ts` — proposal and sentence-writing. Takes an **injected model client**
  so tests run without network.
- `src/core/render.ts` — `Brief → draft prose`. Pure, deterministic, golden-testable.
- `src/ui/BoardView.tsx` — the block board.
- `src/ui/BlockRow.tsx` — one block: display, edit, remove, drag handle.
- `src/ui/ProposalCard.tsx` — the staged proposal with its options.

## Existing code

**Survives unchanged:** `core/ai.ts` (BYO-key client, `AiError` taxonomy, truncation handling),
`state/settings.ts` + `ui/SettingsPanel.tsx`, `core/rng.ts`, the vitest/jsdom harness.

**Repurposed:** `core/share.ts` and `state/favorites.ts` carry a `Brief` instead of a
`GeneratedPrompt`. `core/generate.ts` + `data/*` demote to cold-start seed material.
`core/brainScout.ts`'s Weekend/Week/Month/Moonshot ladder is absorbed as the options of a
`scope` block rather than deleted.

**Retired:** `ui/FilterBar.tsx`, `Filters`, `DIFFICULTY_TO_TIME`, the difficulty axis,
`SurpriseHero`/`PromptCard` as product surfaces.

**Contract break, stated deliberately:** `src/core/types.ts` carries
`FROZEN Layer 1 contract … Do not edit after T-001 lands`. This design edits it. The freeze
served a one-night build where parallel agents needed a stable contract; it is not a permanent
constraint, and the pivot from fixed-corpus generation to open-ended briefs makes `Filters`,
`Difficulty` and `GeneratedPrompt` obsolete. The header is replaced, not silently amended.

**Targeted cleanup in code we're already touching:** `FavoritesView` still uses the local
subscription workaround from KI-1 instead of the fixed `useFavorites` hook. Favorites change
shape here anyway, so it migrates back as part of that work.

## Error handling

Reuse `AiError` and the behaviours the last adversarial review already fixed — shape-checked
parsing, in-flight invalidation on settings change, `max_tokens` truncation handling, URL scrub.

- **No key / 401** — board stays usable. Sentences fall back to local templates, matching the
  existing offline mode. This is a **degraded path only**: the LLM writes every sentence
  whenever a key is present, because template prose is the original complaint.
- **429 / network** — the staged proposal shows a retry; the `Brief` is untouched.
- **Malformed or truncated proposal** — shape check rejects it, one retry, then a manual
  "add a block yourself" affordance. A bad response can never write to the `Brief`.
- **Polish pass fails at Confirm** — the raw draft is already complete and copyable.

The invariant: **proposals are staged; only user acceptance mutates the `Brief`.**

## Testing

- `brief.ts` — reducer unit tests: add, edit, remove, reorder, accept, ignore, and that an
  ignored proposal leaves state byte-identical.
- `render.ts` — golden tests: fixed `Brief` → expected prose; block order changes output;
  removing a block removes exactly its sentence.
- `interview.ts` — stub model client returning canned and deliberately malformed payloads;
  asserts the shape check rejects the bad ones without mutating state.
- `BoardView` — jsdom tests following the existing `App.test.tsx` / `aiFlow.test.tsx` pattern:
  place a block, edit it, remove it, add a user block, reach Confirm.
- Tests for retired modules are deleted, not skipped.

## Out of scope

Eval pipelines, A/B compare, variable management, multi-provider support, chat history,
accounts, a prose/structured output toggle, confetti and streak stats.

## Risks

1. **The real competitor is `/brainstorming`, not anything in the table.** It is installed, it
   works, and it already wins. This app's value is concentrated in the lego board and in
   persistence — the parts a chat structurally cannot do — and almost not at all in the
   questions themselves. If the board isn't good, there is no reason to open the tab.
2. **Prose quality rests entirely on the sentence-writing prompt.** That prompt is the product;
   it is the thing to iterate, and the original complaint returns if it is weak.
3. **Token cost per block.** Two calls per accepted block (propose + write). Acceptable for a
   short interview; worth measuring before adding blocks.
