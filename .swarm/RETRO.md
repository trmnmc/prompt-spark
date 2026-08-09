# prompt-spark — run retro

Run: 2026-08-09 | cycles run: 11 | stop reason: clock (stop_at 05:30, wrap began ~05:00 after last polish item)

## What worked

- Contract-freeze-first (Layer 1, one fable builder) enabled every later parallel wave: 6 build waves, k up to 4, zero same-file merge conflicts between wave items (cycles 3-8)
- route_class core→fable: T-001, T-005, T-006 all arrived first-attempt verified with exact domain-rule conformance (cycles 3, 6, 7)
- Look passes found real user-visible bugs the green suite missed: FilterBar leaking onto all tabs (cycle 6), raw enum chips + run-on Twist punctuation (cycle 7) (cycles 6, 7)
- Adversarial verification discarded 3 of 11 review findings as unreproducible — none were fixed on speculation (cycle 9)
- Conductor strict re-verification caught a masked failure: a try/catch diagnostic probe reported pass; the strict no-catch rerun exposed the useFavorites infinite loop (cycle 7)
- Wave autotune walked k 3→4→5 on clean streaks; no wave was ever reverted (cycles 4-8)

## What thrashed

- review-fix fixer branch-6 hit merge conflicts and was dropped, its 3 findings requeued to cycle 10 — why: the workflow assigned three fixers overlapping file scopes (all touched App.tsx), so sequential merging guaranteed at least one conflict (cycles 9, 10)
- useFavorites hook shipped broken despite 15 green store tests — why: no test ever mounted a component using the hook; useSyncExternalStore's snapshot-stability contract is only exercised by a real mount (cycles 6, 7, 8)
- Pipe-eats-exit-code (L-010) nearly recurred twice in conductor verification (`| tail`, `| head` after the command under test) — why: zsh lacks bash PIPESTATUS; caught both times before evidence was journaled, re-run direct (cycles 3, 5)

## Config recommendations

- [qa] Exported React hooks need a component-mount test — store-function tests stay green while a useSyncExternalStore contract violation crashes every consumer on mount [apply: prompt builder "Any exported React hook must ship a test that mounts a real component using it"] [confidence: high] [source: 2026-08-09 prompt-spark] (evidence: cycles 6-8, KI-1)
- [process] A diagnostic probe that swallows its own failure reports success — conductor verification probes must assert loudly (no try/catch around the assertion under test) [confidence: high] [source: 2026-08-09 prompt-spark] (evidence: cycle 7 KI-1 repro)
- [process] Review-fix fixers sharing files conflict at merge; give fixers pairwise-disjoint file scopes like build waves, or plan on dropping/requeuing branches [confidence: med] [source: 2026-08-09 prompt-spark] (evidence: cycle 9 branch-6 drop)
- [prompt] Same-file work discovered mid-run should fold into the wave item that owns the file rather than becoming a second item (T-017→T-010 worked cleanly) [confidence: med] [source: 2026-08-09 prompt-spark] (evidence: cycles 6-7)

## Applied lessons check

- L-002: re-observed (cycles 3, 6, 7 — all three core-routed items first-attempt verified)
- L-003: re-observed (cycles 6-9 — seeded deterministic checks were the working QA pattern)
- L-006: not-exercised (ESM/TS app; collision-scan reported not-applicable, cycles 3-4)
- L-007: re-observed (cycles 6, 7 — look passes produced 5 real findings tests missed)
- L-008: re-observed, adapted (cycle 3 — raw line conflicts with worktree waves; reworded to "commit only on your wave branch, never main"; no builder ever committed to main)
