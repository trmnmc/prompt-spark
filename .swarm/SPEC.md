# SPEC — prompt-spark

<!-- Instantiated at kickoff (SKILL.md KICKOFF step 5). Frozen after user confirmation. -->

## Idea

A fun, easy, simple project-prompt creator: a playful web app that generates project
ideas/prompts across subjects — real estate, law, finance, science — so the user can
grab an inspiring, well-scoped project prompt in seconds. Includes a **Brain Scout**
mode: type a small seed idea and get it rapidly expanded into larger, structured
project ideas (scope ladders + angle remixes) for fast ideation on the go.

## Audience

Truman (and friends): builders/learners who want a quick spark — a project prompt to
build tonight or an idea expanded into something bigger. Used on desktop and phone.

## Must-haves

<!-- The PLAN gate holds until every box is covered by a backlog item.
     Checked off only after conductor verification, never by claim. -->

- [x] Subject packs: curated prompt templates for Real Estate, Law, Finance, Science
      (≥10 base prompts per subject, each with fill-in variables that get randomized)
      <!-- verified cycle 4: 12 templates/pack, validatePack=[], all difficulties -->

- [x] Randomizer / "Surprise me" button: one tap generates a complete project prompt
      (subject × template × variables × twist), seedable for deterministic testing
- [x] Difficulty + time-estimate tags on every prompt (easy/medium/hard mapped to
      time bands), with filtering by subject and difficulty
- [x] Copy-to-clipboard on every generated prompt + favorites list persisted in
      localStorage (add, view, remove)
- [x] Brain Scout: input a seed idea → client-side expansion into a scope ladder
      (weekend build → week project → month project → moonshot) plus 3+ angle
      remixes drawn from the subject packs' lenses; results copyable/saveable

## Nice-to-haves

- Shareable prompt via URL params (prompt state encoded in the link)
- Streak/fun stats ("prompts sparked today"), light confetti on generate
- Dark mode following system preference
- Export favorites as Markdown

## Non-goals

- No backend, no accounts, no external APIs or LLM calls — everything client-side
- No user-authored template editor (curated packs only this run)
- No native mobile app — responsive web only

## Taste notes

Playful, colorful, fast. Big friendly "Surprise me" button as the hero. Feels like a
toy, works like a tool. Mobile-first responsive (Brain Scout is an on-the-go feature).
Micro-animations OK; nothing that blocks interaction. No AI-slop gradients-on-
everything; pick a confident palette and commit.

## Domain rules

<!-- Ground truth for QA: stated precisely enough to hand-compute expected outputs. -->

- The randomizer is a pure function of a seed: `generate(seed, filters)` with the same
  seed and filters MUST return the identical prompt (string-equal). UI "Surprise me"
  uses a random seed; tests pass explicit seeds.
- Difficulty → time-estimate mapping is fixed: easy = "1–2 hours", medium = "an
  evening or two (3–6 hours)", hard = "a weekend+ (10+ hours)". A prompt's difficulty
  comes from its template metadata, never randomized independently of the template.
- Filters are conjunctive: subject filter AND difficulty filter both apply; empty
  filter = all. Filtered generation must only ever emit templates matching the filter.
- Favorites: adding the same generated prompt twice is a no-op (dedupe by generated
  prompt id = hash of seed+template id); removal deletes exactly one entry;
  favorites survive reload via localStorage key `prompt-spark:favorites:v1`.
- Brain Scout ladder always has exactly 4 rungs in order: Weekend, Week, Month,
  Moonshot. Each rung's text must contain the user's seed phrase verbatim at least
  once. Remixes: exactly 3, each labeled with a distinct subject lens.

## Definition of done

All five must-haves demonstrably working in a real browser (not just unit tests);
`npm test` green; `npm run build` succeeds; responsive at 375px and 1280px widths
with no horizontal scroll; no console errors on the happy path; REPORT.md honest
about verified vs claimed.

## Commands

- run: `npm run dev -- --port 5199 --strictPort`
- test: `npx vitest run`

## Spec digest

- Playful React+Vite SPA that generates fun, well-scoped project prompts across
  Real Estate / Law / Finance / Science subject packs
- Core: seedable deterministic randomizer, difficulty+time tags with filters,
  copy + localStorage favorites
- Brain Scout: seed idea → 4-rung scope ladder (Weekend→Moonshot) + 3 subject-lens
  remixes, all client-side, mobile-first
- No backend, no external APIs, no template editor; toy-like feel, tool-like speed
- Done = must-haves verified in a live browser + vitest green + build passes +
  responsive 375/1280
