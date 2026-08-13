# Preview gate — know what you're getting before you spend the tokens

**Date:** 2026-08-13
**Status:** design approved, spec pending review
**Builds on:** `2026-08-10-prompt-spark-interview-design.md` (the interview board, shipped)

## Problem

The board shows the prompt growing, but "Finish & polish" is a blind exit: one polish
pass, then Copy, then the user finds out what their prompt actually produces by burning
a Claude Code session on it. The expensive tokens are the downstream ones — an
implementation session built on an under-specified prompt — and nothing in the app
guards them.

The user named the experience to steal from: Claude Design fleshes the idea out and
keeps offering questions until you *know what you're about to get* before anything
expensive runs.

## What was scouted

Eight queries across four channels (broad ×3, `--topic=human-in-the-loop`, naming
variants `dry-run`/`plan approve`, WebSearch, plus commit-level re-verification of a
cycle-2 finalist). No adoptable open-source implementation exists: the healthy repos
are a Claude Code plugin (optim-plans, 455★ MIT, the reviewed-plan discipline) and
approval infrastructure (humanlayer, 11k★, gates on tool calls — wrong layer). The
pattern itself is table stakes in closed commercial builders (Replit Agent 4's
ideation phase, BrainGrid, NxCode, Emergent), which validates it without providing
code. Verdict: build, stealing one rule from optim-plans — **the artifact the user
approves is byte-for-byte the artifact that ships**, never a paraphrase.

## The feature

"Finish & polish" becomes a **preview gate** between the board and Copy:

1. **Stacked preview.** Finishing produces two stacked panels rendered from the frozen
   `Brief`: the **polished prompt** on top, and an **outcome sketch** beneath it —
   what you would end up with if you handed this prompt to a coding agent: the
   screens/surfaces, the core behaviors, and explicitly what it will NOT include.
   Two model calls per preview cycle.

2. **Guesses become questions.** To write the sketch the model must fill gaps the
   brief leaves open; those inventions are, by definition, the brief's ambiguities.
   The sketch call returns them as a structured list, and each renders as a
   **"pin this down" chip**. Clicking a chip stages that guess as a normal interview
   proposal (question + options, recommended first); accepting it places a block
   through the existing accept path. This is the "ask more questions until I really
   know" loop, aimed at exactly the gaps the preview exposed.

3. **Copy gates on approval.** Copy appears only on the preview and copies exactly
   the polished text the user read. Any mutation of the brief (add, edit, remove,
   move, chip-accept) drops the preview via the existing `commit()` invalidation;
   Copy disappears with it until the user previews again.

## Data model

```
Guess = {
  id: string            // djb2 hex over sketch text + topic, existing convention
  topic: string         // short label, e.g. "Data storage"
  assumption: string    // what the sketch assumed, e.g. "kept in localStorage"
}

Preview = {
  polished: string      // the exact copyable text
  outcome: string       // the sketch prose (includes a "won't include" portion)
  guesses: Guess[]      // 0..5
  briefUpdatedAt: number  // staleness key: preview is valid iff === brief.updatedAt
}
```

`Preview` is ephemeral UI state in `App` (like `proposal`), NOT persisted to
localStorage. A reload drops it; re-previewing is two calls. `briefUpdatedAt` is a
belt-and-braces staleness check on top of `commit()` clearing it.

## Model calls

Both in `src/core/interview.ts`, both through the injected `ModelClient`, both
shape-checked like `proposeNext` — a malformed response throws `AiError` and can
never corrupt state.

- `polish(client, draft)` — exists, unchanged.
- `sketchOutcome(client, brief): Promise<{ outcome: string; guesses: Guess[] }>` —
  new. System prompt: describe concretely what a coding agent given this prompt
  would produce (surfaces, behaviors, and a "will not include" list), then list
  every assumption you had to invent as `{topic, assumption}` pairs, 0–5, JSON.
  Shape check: `outcome` non-empty string; `guesses` an array of objects with
  non-empty string `topic`/`assumption`; excess guesses truncated to 5; a missing
  or malformed `guesses` array degrades to `[]` rather than failing the preview
  (the sketch is still useful without chips).
- `chipToProposal(client, brief, guess): Promise<Proposal>` — new. Turns a guess
  into one interview question with 2–4 options, the sketch's assumption FIRST
  (it becomes the recommended option — accepting the default confirms the guess).
  Reuses the `Proposal` shape and validation verbatim.

## UI

- `src/ui/PreviewPanel.tsx` — replaces the polished-panel block in `App.tsx`.
  Renders: polished prompt, outcome sketch, "won't include" styled distinctly,
  guess chips, and exactly ONE copy affordance: the "Looks right — Copy" primary
  action (with "Back to the board" secondary). One gate, one button.
  Presentational; all async stays in `App`.
- `BoardView` is unchanged except the Finish button label: "Preview what you'll get".
- Chip click → `App.handlePinDown(guess)`: calls `chipToProposal`, stages the result
  as the normal `proposal` state, scrolls to the board. The preview drops when the
  resulting block is accepted (mutation → `commit()` → cleared), not on chip click —
  cancelling out of the question keeps the preview alive.

## Flow

```
Board --Preview what you'll get--> [polish + sketchOutcome, parallel]
  --> PreviewPanel (prompt + outcome + chips)
        --Copy--> done (clipboard gets the exact previewed text)
        --chip--> chipToProposal --> proposal staged --> accept places block
                    --> commit() drops preview --> user re-previews when ready
        --edit/remove/move on board--> commit() drops preview
```

## Error handling

Existing taxonomy throughout; no new error types.

- `polish` fails → preview renders with the raw draft in the prompt slot, noted
  inline ("polish unavailable — this is the unpolished draft"). Copy still works;
  the user never gets less than yesterday's behavior.
- `sketchOutcome` fails → prompt panel renders alone with a note; no chips. Copy
  still gates on this (degraded) preview.
- `chipToProposal` fails → note on the chip row; other chips stay clickable.
- No key → no sketch, no chips; the preview is the raw draft plus the existing
  template-mode note. Copy gates on it identically, so the interaction contract
  is the same in both modes.

## Testing

- `interview.test.ts` additions: `sketchOutcome` good/malformed/guess-less payloads
  (stub client); guesses truncated at 5; `chipToProposal` places the assumption as
  the first option and passes `Proposal` validation; failures throw `AiError`.
- `interviewFlow.test.tsx` additions (no-key path): Finish shows the preview panel;
  Copy appears only there; any block mutation removes the panel; re-finishing
  restores it.
- `PreviewPanel` unit test: renders all sections; Copy fires with the exact
  polished string; chip click fires with the right `Guess`.

## Out of scope (YAGNI)

Token/cost meters, persisting previews, sketch-to-sketch diffing, multiple preview
history, streaming the sketch, images/wireframes in the sketch.

## Risks

1. **Sketch quality is the feature.** A vague sketch ("an app with a nice UI")
   guards nothing. The system prompt must force concreteness — named screens, named
   behaviors, a real won't-include list — and this prompt will need iteration
   against real model output, which nothing in this repo has exercised yet.
2. **Chip fatigue.** Five chips every preview would nag. The prompt asks only for
   assumptions that would *change what gets built* — cosmetic guesses stay out.
3. **Two calls per preview** is the price of the gate; acceptable because previews
   are user-initiated and infrequent by design.
