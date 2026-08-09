/**
 * Real Estate subject pack — 12 curated project templates spanning all
 * three difficulty tiers. Conforms to the FROZEN Layer 1 contract in
 * ../core/types and ./schema. See T-002.
 */
import type { Template } from '../core/types'
import type { SubjectPack } from './schema'

const templates: Template[] = [
  {
    id: 're-01',
    subject: 'realEstate',
    difficulty: 'easy',
    text: 'Build a {tool} that compares renting vs. buying a {property_type} over {time_horizon} and shows the break-even point',
    vars: {
      tool: ['calculator', 'mini web app', 'interactive dashboard', 'quick single-page tool'],
      property_type: ['studio apartment', 'starter home', 'downtown condo', 'suburban duplex'],
      time_horizon: ['3 years', '5 years', '7 years', '10 years'],
    },
    twists: [
      'Add a what-if slider for interest rate changes',
      'Let users compare two cities side by side',
      "Add a 'life happens' toggle for surprise repair costs",
    ],
  },
  {
    id: 're-02',
    subject: 'realEstate',
    difficulty: 'easy',
    text: 'Build a {tool} that scores a {location_type} on {metric} using nothing but public data you scrape or hardcode',
    vars: {
      tool: ['scorecard app', 'ranking tool', 'browser widget', 'interactive dashboard'],
      location_type: ['zip code', 'neighborhood', 'city block', 'school district'],
      metric: ['walkability', 'tree coverage', 'noise level', 'grocery access'],
    },
    twists: [
      'Let users weight the metrics themselves with sliders',
      'Add a simple heatmap view over a map',
      "Show a 'twin neighborhoods' suggestion somewhere else in the country",
    ],
  },
  {
    id: 're-03',
    subject: 'realEstate',
    difficulty: 'easy',
    text: "Build a {tool} that flags when a listing's claimed {metric} looks suspicious for a {property_type}",
    vars: {
      tool: ['fact-checker', 'browser widget', 'quick single-page tool', 'sniff-test app'],
      metric: ['square footage', 'bedroom count', 'lot size', 'year built'],
      property_type: ['studio apartment', 'starter home', 'downtown condo', 'fixer-upper'],
    },
    twists: [
      'Pull in a few comparable listings automatically',
      "Add a 'red flag' badge system with severity levels",
      "Let users paste a listing's text and auto-extract the claims",
    ],
  },
  {
    id: 're-04',
    subject: 'realEstate',
    difficulty: 'easy',
    text: 'Build a {tool} that estimates total {metric} for moving into a {property_type}, from deposit to first grocery run',
    vars: {
      tool: ['calculator', 'checklist app', 'budgeting widget', 'mini web app'],
      metric: ['move-in costs', 'first-month cash needed', 'setup expenses'],
      property_type: ['studio apartment', 'starter home', 'downtown condo', 'suburban duplex'],
    },
    twists: [
      'Add a slider for how much furniture they already own',
      'Break the total into a week-by-week spending calendar',
      "Add a 'panic mode' that finds the bare minimum to move in",
    ],
  },
  {
    id: 're-05',
    subject: 'realEstate',
    difficulty: 'medium',
    text: 'Build a {tool} that lets someone drag sliders to see how {metric} changes their monthly payment on a {property_type}',
    vars: {
      tool: ['simulator', 'interactive dashboard', 'mini web app', 'calculator'],
      metric: ['interest rate', 'down payment size', 'loan term length', 'PMI status'],
      property_type: ['starter home', 'downtown condo', 'suburban duplex', 'multi-family building'],
    },
    twists: [
      'Add an amortization chart that animates as sliders move',
      "Show a 'time to payoff' countdown that updates live",
      'Add a refinance-later scenario toggle',
    ],
  },
  {
    id: 're-06',
    subject: 'realEstate',
    difficulty: 'medium',
    text: 'Build a {tool} that estimates {metric} for renovating a {property_type} using public data',
    vars: {
      tool: ['ROI estimator', 'renovation planner', 'interactive dashboard', 'calculator'],
      metric: ['resale value bump', 'cost-to-value ratio', 'payback period'],
      property_type: ['starter home', 'suburban duplex', 'fixer-upper', 'downtown condo'],
    },
    twists: [
      'Add a what-if slider for renovation budget',
      'Let users pick which rooms to renovate and see combined ROI',
      "Add a 'DIY vs. contractor' cost toggle",
    ],
  },
  {
    id: 're-07',
    subject: 'realEstate',
    difficulty: 'medium',
    text: 'Build a {tool} that maps {metric} from a {property_type} to a handful of saved destinations',
    vars: {
      tool: ['commute mapper', 'interactive dashboard', 'browser widget', 'mini web app'],
      metric: ['commute time', 'commute cost', 'transit options'],
      property_type: ['studio apartment', 'starter home', 'downtown condo', 'suburban duplex'],
    },
    twists: [
      'Let users drag destinations onto a map to add them',
      'Add a monthly transit cost comparison to driving',
      "Show a 'worst commute day' weather-adjusted estimate",
    ],
  },
  {
    id: 're-08',
    subject: 'realEstate',
    difficulty: 'medium',
    text: "Build a {tool} that compares a {property_type}'s asking rent against {metric} for similar units nearby",
    vars: {
      tool: ['fair rent checker', 'comparison dashboard', 'mini web app', 'calculator'],
      metric: ['median rent', 'price per square foot', 'recent lease prices'],
      property_type: ['studio apartment', 'downtown condo', 'suburban duplex', 'starter home'],
    },
    twists: [
      'Add a negotiation script generator based on the gap found',
      'Show a percentile ranking against the whole zip code',
      "Add a 'rent trend over time' mini chart",
    ],
  },
  {
    id: 're-09',
    subject: 'realEstate',
    difficulty: 'hard',
    text: 'Build a {tool} that models {metric} across the full lifecycle of flipping a {property_type}, from purchase to resale',
    vars: {
      tool: ['profitability engine', 'simulation dashboard', 'modeling tool'],
      metric: ['total profit', 'holding costs', 'break-even resale price'],
      property_type: ['fixer-upper', 'starter home', 'suburban duplex', 'multi-family building'],
    },
    twists: [
      'Add a Monte Carlo mode that runs hundreds of market scenarios',
      'Let users adjust contractor delay risk and see profit impact',
      "Add a 'worst case vs. best case' side-by-side comparison",
    ],
  },
  {
    id: 're-10',
    subject: 'realEstate',
    difficulty: 'hard',
    text: 'Build a {tool} that overlays {metric} onto a map of {property_type} listings so buyers can see risk at a glance',
    vars: {
      tool: ['risk overlay map', 'interactive dashboard', 'mapping tool'],
      metric: ['flood risk', 'wildfire risk', 'heat risk', 'insurance cost trend'],
      property_type: ['starter home', 'suburban duplex', 'downtown condo', 'multi-family building'],
    },
    twists: [
      'Add a 30-year projection slider for climate trends',
      'Let users layer two risk types at once with a blend view',
      "Add an 'estimated insurance cost' popup per listing",
    ],
  },
  {
    id: 're-11',
    subject: 'realEstate',
    difficulty: 'hard',
    text: 'Build a {tool} that ingests a {document_type} for a {property_type} and surfaces the {metric} buried inside',
    vars: {
      tool: ['document digest tool', 'plain-English summarizer', 'clause extractor'],
      document_type: ['HOA bylaws packet', 'condo master deed', "homeowners association budget report"],
      property_type: ['downtown condo', 'suburban duplex', 'multi-family building'],
      metric: ['fee increases', 'pet restrictions', 'rental restrictions', 'special assessments'],
    },
    twists: [
      'Add a severity score for how restrictive the rules are',
      "Highlight clauses that changed from a prior year's document",
      "Add a 'translate to a 5th-grade reading level' mode",
    ],
  },
  {
    id: 're-12',
    subject: 'realEstate',
    difficulty: 'hard',
    text: 'Build a {tool} that simulates {metric} across a portfolio of {property_type}s over {time_horizon}',
    vars: {
      tool: ['portfolio simulator', 'modeling dashboard', 'forecasting tool'],
      metric: ['cash flow', 'appreciation', 'total equity growth'],
      property_type: ['starter home', 'suburban duplex', 'multi-family building', 'downtown condo'],
      time_horizon: ['5 years', '10 years', '15 years', '20 years'],
    },
    twists: [
      "Add a 'sell one to buy two' rebalancing scenario",
      'Let users simulate a bad tenant year and see portfolio impact',
      'Add a vacancy-rate stress test slider',
    ],
  },
]

export const pack: SubjectPack = {
  subject: 'realEstate',
  label: 'Real Estate & Property Tech',
  templates,
  lenses: [
    'rent vs buy calculators',
    'neighborhood scouting tools',
    'renovation ROI estimators',
    'property data mashups',
    'landlord/tenant fairness checkers',
  ],
}
