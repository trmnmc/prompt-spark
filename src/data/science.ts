/**
 * Science subject pack — orbital sandboxes, ecosystem sims, and
 * kitchen-chemistry loggers. All client-side buildable: canvas/SVG
 * animations, device sensors where available, and manual data entry.
 * Conforms to the frozen Layer 1 contract (src/core/types.ts,
 * src/data/schema.ts).
 */
import type { SubjectPack } from './schema'

export const pack: SubjectPack = {
  subject: 'science',
  label: 'Science',
  lenses: [
    'citizen-science data',
    'simulation sandboxes',
    'kitchen-chemistry logs',
    'orbital mechanics toys',
    'ecosystem simulators',
    'sensor-powered instruments',
  ],
  templates: [
    {
      id: 'sci-01',
      subject: 'science',
      difficulty: 'easy',
      text: 'Build a two-body orbital sandbox: drag a {body} into orbit around a {center} and watch gravity draw its {pathStyle} in real time as you tweak starting velocity.',
      vars: {
        body: ['moon', 'comet', 'satellite', 'asteroid'],
        center: ['planet', 'star', 'binary pair', 'black hole (toy physics)'],
        pathStyle: ['glowing trail', 'dotted ellipse', 'fading comet tail', 'pulsing orbit ring'],
      },
      twists: [
        'Add a "slingshot" mode where a passing body can steal or add momentum from the orbiting object.',
        'Add a speed multiplier slider so users can fast-forward years of orbits in seconds.',
        'Let users save and compare two different starting velocities side by side as ghost trails.',
      ],
    },
    {
      id: 'sci-02',
      subject: 'science',
      difficulty: 'easy',
      text: 'Build a kitchen-chemistry reaction logger: users log a {reaction} experiment with photos and notes, tagging {variable} and getting an auto-generated {outputStyle} of results over repeated trials.',
      vars: {
        reaction: ['baking-soda-and-vinegar', 'red-cabbage-pH-indicator', 'oil-and-water-emulsion', 'yeast-and-sugar-fermentation'],
        variable: ['temperature', 'quantity ratios', 'time elapsed', 'container shape'],
        outputStyle: ['trend chart', 'lab notebook timeline', 'before/after photo grid', 'reaction "scorecard"'],
      },
      twists: [
        'Add a hypothesis field before each trial, then auto-compare the prediction to what actually happened.',
        'Add a "reaction speed" stopwatch feature timed from mix to visible change.',
        'Generate a printable "lab report" summarizing a week of logged experiments.',
      ],
    },
    {
      id: 'sci-03',
      subject: 'science',
      difficulty: 'easy',
      text: 'Build a plant-growth time-lapse logger: log a daily photo and {measurement} for a {plantType}, then auto-stitch entries into a {output} showing growth over the season.',
      vars: {
        measurement: ['height', 'leaf count', 'soil moisture', 'sunlight hours'],
        plantType: ['windowsill herb', 'bean sprout', 'succulent', 'backyard tomato'],
        output: ['flipbook-style time-lapse', 'growth curve chart', 'side-by-side comparison grid', 'animated sprite that grows'],
      },
      twists: [
        'Add a "what changed" annotation prompt each time growth rate visibly speeds up or stalls.',
        'Let users log multiple plants and race their growth curves against each other.',
        'Add a watering/sunlight reminder that gamifies streaks with a small badge system.',
      ],
    },
    {
      id: 'sci-04',
      subject: 'science',
      difficulty: 'easy',
      text: 'Build a periodic-table trading-card generator: pick an element and get an auto-generated {cardStyle} card showing its {stat} as a game stat, ready to print or collect digitally.',
      vars: {
        cardStyle: ['holographic-style', 'retro-pixel', 'comic-book', 'minimalist-flashcard'],
        stat: ['atomic number and mass as "power level"', 'reactivity as "attack stat"', 'electron shells as "abilities"', 'discovery year as "rarity tier"'],
      },
      twists: [
        'Add a "battle mode" that compares two element cards using their stats to pick a playful "winner."',
        'Auto-group cards into a full printable deck sorted by family (noble gases, metals, etc).',
        'Add a quiz mode that shows a card with stats hidden and asks users to guess the element.',
      ],
    },
    {
      id: 'sci-05',
      subject: 'science',
      difficulty: 'medium',
      text: 'Build a predator-prey ecosystem simulator: place {predator} and {prey} populations on a grid, run a Lotka-Volterra-style simulation, and visualize population swings as an animated {chart} over time.',
      vars: {
        predator: ['foxes', 'wolves', 'owls', 'orcas'],
        prey: ['rabbits', 'deer', 'mice', 'seals'],
        chart: ['line chart with pulsing dots', 'live population bar race', 'grid of moving sprites', 'wave-form oscillator view'],
      },
      twists: [
        'Add a "drought" or "bumper harvest" event slider that perturbs the food supply mid-run.',
        'Let users tweak birth/death rates live and watch the equilibrium shift in real time.',
        'Add a "collapse" state with a visual/audio cue when a population crashes to zero.',
      ],
    },
    {
      id: 'sci-06',
      subject: 'science',
      difficulty: 'medium',
      text: 'Build a constellation storyteller: users connect stars on a night-sky canvas into a custom shape, and the app generates a {tone} myth explaining the constellation, styled as {format}.',
      vars: {
        tone: ['whimsical', 'epic', 'silly', 'ancient-astronomer-serious'],
        format: ['an illustrated scroll', 'a bedtime-story card', 'a museum placard', 'a comic strip'],
      },
      twists: [
        'Add a "real sky" overlay toggle showing actual star names near the user\'s custom shape.',
        'Let users save a gallery of invented constellations and browse everyone\'s myths.',
        'Add a seasonal mode that only shows stars visible in the current month\'s night sky.',
      ],
    },
    {
      id: 'sci-07',
      subject: 'science',
      difficulty: 'medium',
      text: 'Build a genetics critter breeder: cross two cartoon {creature} parents using a Punnett-square engine, and reveal offspring traits like {trait} with a hatching/reveal animation.',
      vars: {
        creature: ['blob monster', 'space hamster', 'garden dragon', 'pixel bird'],
        trait: ['color and pattern', 'ear shape and size', 'wing style', 'eye color and glow'],
      },
      twists: [
        'Add a "rare trait" mode where recessive combinations have a small chance of unlocking a shiny variant.',
        'Let users build and browse a "family tree" of bred critters across generations.',
        'Add an in-app Punnett-square worksheet view that shows the actual probability grid before the reveal.',
      ],
    },
    {
      id: 'sci-08',
      subject: 'science',
      difficulty: 'medium',
      text: 'Build a backyard biodiversity logger: users log {sighting} sightings with photo, location pin, and timestamp, and the app builds a personal {output} of local wildlife over a season.',
      vars: {
        sighting: ['bird', 'insect', 'wildflower', 'fungi'],
        output: ['species checklist with counts', 'seasonal activity heatmap', 'photo field guide', 'streak calendar of daily finds'],
      },
      twists: [
        'Add a "rarity" badge system that flags uncommon sightings based on the user\'s own logging history.',
        'Add a weather-at-time-of-sighting auto-tag to spot patterns (e.g. birds after rain).',
        'Let users export their season\'s log as a shareable "field notebook" page.',
      ],
    },
    {
      id: 'sci-09',
      subject: 'science',
      difficulty: 'hard',
      text: 'Build a DIY seismograph using the device\'s motion sensor: capture {motionSource} vibrations, render a live {waveform} readout, and log "quakes" that cross a user-set sensitivity threshold.',
      vars: {
        motionSource: ['tapping the table', 'stomping nearby', 'a passing truck outside', 'a dropped book'],
        waveform: ['scrolling ink-pen trace', 'oscilloscope-style wave', 'seismic drum-style strip chart', 'bar-graph pulse meter'],
      },
      twists: [
        'Add a "Richter-style" playful magnitude score computed from peak amplitude.',
        'Add an event log with timestamped snapshots users can replay like a mini earthquake history.',
        'Add a calibration mode that helps users tune sensitivity to ignore background jitter.',
      ],
    },
    {
      id: 'sci-10',
      subject: 'science',
      difficulty: 'hard',
      text: 'Build a physics playground: a canvas sandbox with adjustable gravity, launch angle, and initial speed for a {projectile}, showing its {trajectoryStyle} trajectory and landing stats in real time.',
      vars: {
        projectile: ['cannonball', 'water balloon', 'basketball', 'paper airplane'],
        trajectoryStyle: ['dotted parabola with live velocity vectors', 'glowing motion trail', 'ghost-trail comparison of past shots', 'grid-overlaid measured arc'],
      },
      twists: [
        'Add an air-resistance toggle that visibly bends the trajectory away from a clean parabola.',
        'Add a target-practice mode that scores how close each shot lands to a moving target.',
        'Let users overlay two shots with different settings to compare arcs side by side.',
      ],
    },
    {
      id: 'sci-11',
      subject: 'science',
      difficulty: 'hard',
      text: 'Build a volcano eruption pressure simulator: model {chamber} pressure building from a chosen {trigger}, with an animated eruption once threshold is crossed, styled after the classic fizzy chemistry-fair volcano.',
      vars: {
        chamber: ['magma chamber', 'baking-soda-and-vinegar core', 'shaken-soda-bottle', 'pressure-cooker'],
        trigger: ['gas buildup rate', 'chamber temperature', 'blockage size', 'reactant concentration'],
      },
      twists: [
        'Add a pressure gauge readout with a visible "danger zone" the user is racing against.',
        'Let users tune variables to try for the biggest eruption without an early blowout, logging their best run.',
        'Add a slow-motion replay mode for the eruption moment with a particle-based lava/foam effect.',
      ],
    },
    {
      id: 'sci-12',
      subject: 'science',
      difficulty: 'hard',
      text: 'Build a DIY oscilloscope from the device microphone: visualize live {soundSource} as a {waveformStyle} waveform, with frequency and amplitude readouts updating in real time.',
      vars: {
        soundSource: ['humming', 'clapping', 'a tuning fork', 'whistling'],
        waveformStyle: ['classic green CRT-style', 'colorful bar-spectrum', 'circular radial', 'scrolling ribbon'],
      },
      twists: [
        'Add a "match the pitch" game mode that challenges users to hum a target frequency.',
        'Add a snapshot/save feature to capture and compare waveforms from different sound sources.',
        'Add a simple FFT-based frequency spectrum view alongside the raw waveform.',
      ],
    },
  ],
}
