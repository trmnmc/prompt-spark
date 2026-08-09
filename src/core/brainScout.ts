/**
 * Brain Scout — expands a user's seed phrase into a 4-rung scope ladder
 * (Weekend / Week / Month / Moonshot) plus 3 subject-lens remixes.
 * See T-006.
 *
 * Pure and deterministic: all variety flows from mulberry32(seed), and the
 * draws are consumed in a fixed, documented order:
 *
 *   1. One draw per rung, in LADDER_RUNGS order (4 draws total), each
 *      picking that rung's sentence template from its pool.
 *   2. Then the remix draws: repeated draws index into ALL_LENSES; a draw
 *      landing on an already-picked lens string is skipped (the draw is
 *      still consumed) until 3 distinct lenses are collected. After each
 *      lens is chosen, one further draw picks its remix template.
 *
 * Ids do NOT depend on the seed — they hash phrase + label so the same
 * phrase always maps to the same ids:
 *   rung id  = unsigned djb2('scout:' + seedPhrase + rung)  as UPPERCASE hex
 *   remix id = unsigned djb2('scout:' + seedPhrase + lens)  as UPPERCASE hex
 */
import { LADDER_RUNGS } from './types'
import type { LadderRung, ScoutRemix, ScoutResult, ScoutRung } from './types'
import { djb2, mulberry32 } from './rng'
import { ALL_LENSES } from '../data/index'

type TemplateFn = (phrase: string) => string

/**
 * Per-rung template pools. Every template embeds the seed phrase VERBATIM
 * (interpolated as given — no trimming, no case change) at least once, and
 * scales the idea to that rung's scope tier.
 */
const RUNG_TEMPLATES: Record<LadderRung, TemplateFn[]> = {
  Weekend: [
    (p) =>
      `A weekend take on "${p}": strip it down to the one interaction that proves the idea. ` +
      `Ship a single-page version with hardcoded sample data and zero settings. ` +
      `If a friend can try it Sunday night and smile, you have won the weekend.`,
    (p) =>
      `Build the tiniest shippable slice of "${p}" in two days: one screen, one happy path, no accounts. ` +
      `Fake everything that is not the core trick, and get it in front of one real person before Monday.`,
    (p) =>
      `Weekend sprint: turn "${p}" into a toy demo you can text to a friend. ` +
      `Pick the single most delightful moment of the idea and build only that. ` +
      `Everything else is a TODO comment — and that is exactly right for now.`,
    (p) =>
      `Give yourself 48 hours and make "${p}" barely real: a scrappy prototype that does one thing end to end. ` +
      `Cut every feature that does not directly demo the core idea, and celebrate shipping something ugly but alive.`,
  ],
  Week: [
    (p) =>
      `With a full week, grow "${p}" into a solid v1: the real happy path plus the two edge cases that actually happen. ` +
      `Add persistence, decent error states, and a UI you would not apologize for. ` +
      `By Friday it should survive a stranger using it unsupervised.`,
    (p) =>
      `A week is enough to make "${p}" trustworthy: real data instead of fixtures, basic settings, and tests around the core logic. ` +
      `Spend the last day polishing the first-run experience so a newcomer understands it in thirty seconds.`,
    (p) =>
      `Seven-day plan for "${p}": days one and two rebuild the prototype properly, days three to five add the features users will ask for first, and the weekend is for polish. ` +
      `The goal is a v1 you would happily link from your own homepage.`,
    (p) =>
      `Treat "${p}" as a one-week product: define the three jobs it must do, build each one properly, and wire them together with a simple, honest interface. ` +
      `Resist every shiny extra — v1 means done, not big.`,
  ],
  Month: [
    (p) =>
      `Over a month, "${p}" becomes a polished product with real users: onboarding, feedback loops, and the boring reliability work that makes people stay. ` +
      `Recruit a dozen testers in week two and let their confusion set the roadmap. ` +
      `Ship weekly and watch retention, not features.`,
    (p) =>
      `A month of focus turns "${p}" into something people recommend: refined design, fast on mobile, and sharp copy in every corner. ` +
      `Instrument the funnel, fix the top three drop-offs, and end the month with actual weekly active users.`,
    (p) =>
      `Month-scale "${p}": weeks one and two harden the core, week three is a private beta with real users, week four turns their feedback into polish. ` +
      `Add the two integrations testers beg for, and write docs good enough that you never answer the same question twice.`,
    (p) =>
      `Give "${p}" thirty days and treat it like a real launch: a landing page that sells the story, a product that keeps its promises, and a small community of genuine users by day thirty. ` +
      `Polish is the feature this month.`,
  ],
  Moonshot: [
    (p) =>
      `The moonshot: "${p}" as the platform an entire ecosystem builds on. ` +
      `Open an API, let others create on top of it, and design for a million users from day one. ` +
      `Aim for the version that makes the original idea look like a rounding error.`,
    (p) =>
      `Dream audaciously: "${p}" grows into the default way the whole world does this. ` +
      `Think marketplaces, network effects, and a name people use as a verb. ` +
      `Plan the wedge product now, but architect for the empire.`,
    (p) =>
      `Moonshot version of "${p}": not a tool but an industry standard, with partners, plugins, and a developer community shipping things you never imagined. ` +
      `The bet is decades long — start by owning one niche completely and expand ring by ring.`,
    (p) =>
      `Imagine "${p}" at planetary scale: an intelligent platform that anticipates its users, an ecosystem of builders extending it, and infrastructure other companies pay to stand on. ` +
      `Absurd today, inevitable in hindsight — that is the moonshot test.`,
  ],
}

/** Remix template pool — each is 1–2 sentences applying a lens to the phrase. */
const REMIX_TEMPLATES: ((phrase: string, lens: string) => string)[] = [
  (p, lens) =>
    `Remix "${p}" through the lens of ${lens}: keep your original idea's soul, but make ${lens} the star mechanic. ` +
    `Suddenly it is a different — and maybe better — project.`,
  (p, lens) =>
    `What if "${p}" borrowed everything great about ${lens}? ` +
    `Rebuild the core experience around that angle and see which version people actually want.`,
  (p, lens) =>
    `Cross-pollinate: take "${p}" and inject the spirit of ${lens} into its main loop. ` +
    `The mashup might be the idea you were actually looking for.`,
]

/** Shared id scheme: unsigned djb2('scout:' + seedPhrase + label) as uppercase hex. */
function scoutId(seedPhrase: string, label: string): string {
  return djb2(`scout:${seedPhrase}${label}`).toString(16).toUpperCase()
}

/**
 * expand — Brain Scout core. Pure + deterministic: same (seedPhrase, seed)
 * always yields a deep-equal ScoutResult. The seedPhrase is embedded
 * verbatim (exactly as given) in every rung and remix text.
 */
export function expand(seedPhrase: string, seed: number): ScoutResult {
  const rand = mulberry32(seed)

  // Draw order step 1: one template pick per rung, in LADDER_RUNGS order.
  const rungs: ScoutRung[] = LADDER_RUNGS.map((rung) => {
    const pool = RUNG_TEMPLATES[rung]
    const template = pool[Math.floor(rand() * pool.length)]
    return {
      rung,
      text: template(seedPhrase),
      id: scoutId(seedPhrase, rung),
    }
  })

  // Draw order step 2 (after all rung draws): pick 3 distinct lenses by
  // successive draws into ALL_LENSES, skipping duplicate lens strings
  // (skipped draws are still consumed), then one draw per remix template.
  const remixes: ScoutRemix[] = []
  const usedLenses = new Set<string>()
  while (remixes.length < 3) {
    const pick = ALL_LENSES[Math.floor(rand() * ALL_LENSES.length)]
    if (usedLenses.has(pick.lens)) continue
    usedLenses.add(pick.lens)
    const template = REMIX_TEMPLATES[Math.floor(rand() * REMIX_TEMPLATES.length)]
    remixes.push({
      lens: pick.lens,
      subject: pick.subject,
      text: template(seedPhrase, pick.lens),
      id: scoutId(seedPhrase, pick.lens),
    })
  }

  return { seedPhrase, rungs, remixes }
}
