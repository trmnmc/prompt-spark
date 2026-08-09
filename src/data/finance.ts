/**
 * Finance subject pack — playful budget tools, spending-habit toys, and
 * gamified money trackers. NOT investment advice; every simulator here is a
 * toy for exploring how numbers move, not a recommendation to buy anything.
 * Conforms to the frozen Layer 1 contract (src/core/types.ts,
 * src/data/schema.ts).
 */
import type { SubjectPack } from './schema'

export const pack: SubjectPack = {
  subject: 'finance',
  label: 'Finance',
  lenses: [
    'compound-interest visualizers',
    'budget gamification',
    'spending-habit dashboards',
    'subscription audits',
    'debt-payoff races',
    'family allowance economies',
  ],
  templates: [
    {
      id: 'fin-01',
      subject: 'finance',
      difficulty: 'easy',
      text: 'Build a budget tracker with a {personality} personality — it {reaction} every time you log a purchase in the {category} category, and keeps a running {metaphor} of your month.',
      vars: {
        personality: [
          'sarcastic raccoon',
          'overly-enthusiastic life coach',
          'deadpan robot butler',
          'anxious accountant squirrel',
        ],
        reaction: [
          'sighs audibly via an animated speech bubble',
          'throws a tiny confetti burst',
          'narrates your choices in the third person',
          'files a passive-aggressive footnote',
        ],
        category: ['coffee', 'impulse online shopping', 'takeout', 'subscription boxes'],
        metaphor: ['thermometer', 'health bar', 'weather forecast', 'mood ring'],
      },
      twists: [
        'Add a "roast mode" toggle that cranks the personality\'s snark to 11 for one category of your choosing.',
        'Let the personality evolve — calmer after a good week, spicier after a splurge weekend.',
        'Generate a shareable "spending horoscope" card summarizing the week\'s mood swings.',
      ],
    },
    {
      id: 'fin-02',
      subject: 'finance',
      difficulty: 'easy',
      text: 'Build a spending-habit roaster: paste in a week of manually-entered transactions and get a {tone} roast of your {habit}, delivered as {format}.',
      vars: {
        tone: ['brutally honest', 'backhanded-compliment', 'stand-up comedian', 'disappointed-parent'],
        habit: ['late-night snack runs', 'app-store impulse buys', 'ride-share habit', 'streaming service hoarding'],
        format: ['a scrolling toast-notification feed', 'a printable "burn report"', 'a comic-strip panel', 'a mock breaking-news ticker'],
      },
      twists: [
        'Add a "redemption arc" mode that softens the roast once spending trends improve.',
        'Let users pick their own roast intensity with a slider from "gentle nudge" to "no survivors."',
        'Generate a shareable roast card sized for social media, with the numbers blurred by default for privacy.',
      ],
    },
    {
      id: 'fin-03',
      subject: 'finance',
      difficulty: 'easy',
      text: 'Build a subscription graveyard: a visual list of {subject} subscriptions where each unused one grows a {decorator} the longer it goes untouched, so you can find what to cancel.',
      vars: {
        subject: ['streaming', 'app', 'meal-kit', 'fitness-app'],
        decorator: ['tombstone and cobwebs', 'layer of dust', 'sad little ghost', 'overgrown weeds'],
      },
      twists: [
        'Add a "resurrect" button that un-ghosts a subscription and starts its dust clock over.',
        'Show a running "money saved this year" counter every time something gets buried.',
        'Add a graveyard leaderboard comparing which category (streaming vs. apps vs. meal kits) has the most ghosts.',
      ],
    },
    {
      id: 'fin-04',
      subject: 'finance',
      difficulty: 'easy',
      text: 'Build a round-up piggy bank simulator: every logged purchase rounds up to the next {roundTo}, and the spare change drops into an animated {container} you\'re saving toward a {goal}.',
      vars: {
        roundTo: ['dollar', '$5', '$10', 'nearest even number'],
        container: ['glass jar that fills with coins', 'digital piggy bank that gets rounder', 'thermometer that rises', 'pixel-art treasure chest'],
        goal: ['weekend trip', 'new bike', 'concert tickets', 'rainy-day cushion'],
      },
      twists: [
        'Add a "shake the jar" gesture/animation that shows a running total breakdown by source purchase.',
        'Let users set a matching bonus (e.g. "match every round-up on Fridays") and visualize the boost.',
        'Add milestone confetti when the jar crosses 25%, 50%, and 100% of the goal.',
      ],
    },
    {
      id: 'fin-05',
      subject: 'finance',
      difficulty: 'medium',
      text: 'Build a dividend snowball simulator: enter a hypothetical starting amount and a {frequency} reinvestment schedule, then watch a snowball {visual} grow across a {timeframe} on an animated hill — a toy for exploring compounding, not real investment advice.',
      vars: {
        frequency: ['monthly', 'quarterly', 'annual', 'custom'],
        visual: ['literally roll and grow bigger', 'stack coins into a tower', 'fill a snow globe', 'grow a snowman'],
        timeframe: ['10-year', '20-year', '30-year', 'user-defined'],
      },
      twists: [
        'Add a "what if you skip a year" slider that shows the snowball visibly shrink in comparison.',
        'Let two snowballs race side by side with different reinvestment frequencies to compare shapes.',
        'Add a big disclaimer banner and an in-app glossary explaining this is a simulation toy, not financial advice.',
      ],
    },
    {
      id: 'fin-06',
      subject: 'finance',
      difficulty: 'medium',
      text: 'Build a bill-splitting app with a "drama meter": as roommates enter shared {expense} costs, an animated meter climbs from {calmLevel} toward {chaosLevel} based on how uneven the split history has become.',
      vars: {
        expense: ['rent and utilities', 'grocery runs', 'weekend takeout', 'household supplies'],
        calmLevel: ['"chill roommates"', '"we\'re fine"', '"mild side-eye"', '"peaceful coexistence"'],
        chaosLevel: ['"house meeting incoming"', '"passive-aggressive sticky notes"', '"someone\'s moving out"', '"full roommate court"'],
      },
      twists: [
        'Add an "IOU settle-up" animation that visibly drains the drama meter when balances even out.',
        'Let each roommate get a nickname and avatar that reacts (happy/annoyed) to their current balance.',
        'Add a monthly "fairness report" that ranks who has fronted the most money over time.',
      ],
    },
    {
      id: 'fin-07',
      subject: 'finance',
      difficulty: 'medium',
      text: 'Build a "{smallHabit} factor" calculator: enter a small recurring purchase and a hypothetical growth rate, then visualize how skipping it {frequency} could compound over {timeframe} — framed explicitly as a playful "what if" toy.',
      vars: {
        smallHabit: ['latte', 'vending-machine snack', 'rideshare', 'takeout lunch'],
        frequency: ['daily', 'a few times a week', 'weekly', 'on weekdays only'],
        timeframe: ['5 years', '10 years', '20 years', 'a user-chosen span'],
      },
      twists: [
        'Add a counter-argument mode that shows the "joy value" you\'d be giving up, not just the dollars.',
        'Let users compare two habits side by side to see which compounds faster.',
        'Add a footer disclaimer clarifying this is an illustrative growth-rate toy, not a real forecast.',
      ],
    },
    {
      id: 'fin-08',
      subject: 'finance',
      difficulty: 'medium',
      text: 'Build an emergency-fund thermometer: a classic fundraising-thermometer visual that fills up as the user logs progress toward a {goalMonths}-month cushion, with {milestoneEvent} at each 25% mark.',
      vars: {
        goalMonths: ['3', '6', '9', 'custom'],
        milestoneEvent: ['a confetti burst and badge', 'a short encouraging animation', 'an unlockable theme color', 'a celebratory sound effect'],
      },
      twists: [
        'Add a "leak detector" that flags withdrawals from the fund with a gentle animated crack in the thermometer.',
        'Let users set a "why" note pinned next to the thermometer (e.g. "so I can quit that job I hate") for motivation.',
        'Add a projected-fill-date estimate that updates live as the user adjusts their monthly contribution.',
      ],
    },
    {
      id: 'fin-09',
      subject: 'finance',
      difficulty: 'hard',
      text: 'Build a debt-payoff race: two animated {racers} — one running the snowball method, one running the avalanche method — race along a track built from a user\'s entered debts, showing payoff order and {finishEvent} at the end.',
      vars: {
        racers: ['snails', 'go-karts', 'rockets', 'hikers on a trail'],
        finishEvent: ['a total-interest-saved scoreboard', 'a fireworks finish animation', 'a side-by-side payoff timeline comparison', 'a "who paid less interest" trophy'],
      },
      twists: [
        'Let users add a hypothetical "extra payment" slider and watch both racers speed up in real time.',
        'Add a "debt snowball momentum" visual where paid-off debts add their payment to the next target automatically.',
        'Include a printable payoff schedule export generated entirely client-side.',
      ],
    },
    {
      id: 'fin-10',
      subject: 'finance',
      difficulty: 'hard',
      text: 'Build an envelope-budgeting app with physics: each spending category is a literal draggable {envelopeStyle} envelope that visibly {stuffBehavior} as you allocate funds, and gets thin/crinkled as it empties.',
      vars: {
        envelopeStyle: ['kraft-paper', 'polka-dot', 'graph-paper', 'washi-tape-decorated'],
        stuffBehavior: ['bulges and bounces with a spring animation', 'stacks little cash-icon sprites inside', 'glows brighter the fuller it gets', 'wobbles when overstuffed'],
      },
      twists: [
        'Add a drag-to-transfer gesture that lets users physically drag cash icons between two envelopes.',
        'Add an "overdraft" state where an envelope visibly rips if spending exceeds its allocation.',
        'Add a month-end "empty the envelopes" ceremony animation that archives the month and resets with confetti.',
      ],
    },
    {
      id: 'fin-11',
      subject: 'finance',
      difficulty: 'hard',
      text: 'Build a family chore-and-allowance economy: kids earn a custom {currencyName} currency for completed {choreType} chores, which they can spend in an in-app "store" on {reward} — a full mini token economy, no real bank involved.',
      vars: {
        currencyName: ['Sparks', 'Bolts', 'Gems', 'Coins'],
        choreType: ['household', 'homework', 'pet-care', 'kitchen-help'],
        reward: ['extra screen time', 'a chosen family activity', 'a small toy fund', 'a "skip a chore" pass'],
      },
      twists: [
        'Add a sibling leaderboard with weekly "top earner" bragging rights.',
        'Add a "savings vs. spend now" choice screen that teaches delayed gratification with a visual payoff multiplier.',
        'Let a parent dashboard mint bonus currency for surprise good behavior, with a notification animation for the kid.',
      ],
    },
    {
      id: 'fin-12',
      subject: 'finance',
      difficulty: 'hard',
      text: 'Build a "financial astrology" generator: it reads a user\'s logged spending patterns and produces a tongue-in-cheek {docType} predicting next week\'s {prediction}, styled like a horoscope column — explicitly satirical, not real forecasting.',
      vars: {
        docType: ['daily horoscope card', 'weekly star chart', 'tarot-style spread', 'fortune-cookie strip'],
        prediction: ['impulse-buy risk', '"lucky" savings day', 'category most likely to overspend', 'ideal day to skip takeout'],
      },
      twists: [
        'Add a "zodiac spending sign" quiz that assigns users a playful money archetype based on their top categories.',
        'Let users screenshot-share their weekly "chart" with the numbers auto-blurred for privacy.',
        'Add a running "accuracy" score that gently mocks the horoscope when its predictions miss.',
      ],
    },
  ],
}
