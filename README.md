# Prompt Spark

A playful React+Vite+TypeScript SPA that generates fun, well-scoped project
prompts across Real Estate / Law / Finance / Science packs (48 curated
templates), with a seedable deterministic randomizer, conjunctive filters with
time-band tags, copy + localStorage favorites, shareable prompt URLs, and a
Brain Scout mode that expands any seed idea into a 4-rung scope ladder plus 3
subject-lens remixes — all client-side, mobile-first.

Built overnight by [SWARM](https://swarm.fenley.ai/projects).

## Run it

```sh
npm install
npm run dev -- --port 5199 --strictPort
# open http://localhost:5199 — try /?seed=42&subject=science for a shared prompt
```

Tests: `npx vitest run` (117 tests). Production build: `npm run build`.

See [REPORT.md](REPORT.md) for the full build report.
