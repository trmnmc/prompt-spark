/**
 * Law subject pack — 12 curated project templates spanning all three
 * difficulty tiers. Practical, everyday-legal-literacy builds: renter
 * rights checkers, contract clause explainers, small-claims prep guides.
 * NOT legal advice engines. Conforms to the FROZEN Layer 1 contract in
 * ../core/types and ./schema. See T-002.
 */
import type { Template } from '../core/types'
import type { SubjectPack } from './schema'

const templates: Template[] = [
  {
    id: 'law-01',
    subject: 'law',
    difficulty: 'easy',
    text: 'Build a {tool} that translates a {document_type} into plain English and flags {metric}',
    vars: {
      tool: ['plain-English translator', 'clause explainer', 'mini web app', 'browser widget'],
      document_type: ['residential lease', 'sublease agreement', 'roommate agreement', 'month-to-month rental contract'],
      metric: ['unusual fees', 'early termination penalties', 'automatic renewal clauses', 'maintenance responsibilities'],
    },
    twists: [
      'Add a severity color-code for each flagged clause',
      'Let users paste any lease and get a jargon glossary sidebar',
      "Add a 'compare to a standard lease' mode",
    ],
  },
  {
    id: 'law-02',
    subject: 'law',
    difficulty: 'easy',
    text: 'Build a {tool} that estimates how much of a {metric} a tenant should get back for a {property_type} based on move-out condition',
    vars: {
      tool: ['calculator', 'deposit estimator', 'mini web app'],
      metric: ['security deposit', 'pet deposit', "last month's rent"],
      property_type: ['apartment', 'rental house', 'shared room', 'studio'],
    },
    twists: [
      "Add a checklist of 'normal wear and tear' vs. damage, with photo prompts",
      "Add a countdown timer for a typical legal return deadline",
      'Generate a draft demand letter if the deposit is withheld',
    ],
  },
  {
    id: 'law-03',
    subject: 'law',
    difficulty: 'easy',
    text: 'Build a {tool} that walks someone through prepping a {case_type} case for small claims court, from evidence checklist to filing',
    vars: {
      tool: ['prep guide', 'step-by-step wizard', 'checklist app', 'mini web app'],
      case_type: ['unpaid security deposit', 'unpaid freelance invoice', 'property damage', 'broken lease'],
    },
    twists: [
      'Add a document checklist that changes based on case type',
      "Add an 'evidence strength' self-scoring quiz",
      'Generate a plain-English case summary the user can print',
    ],
  },
  {
    id: 'law-04',
    subject: 'law',
    difficulty: 'easy',
    text: 'Build a {tool} that tracks legal deadlines after receiving a {document_type}, counting down in plain language',
    vars: {
      tool: ['deadline tracker', 'countdown widget', 'calendar app', 'mini web app'],
      document_type: ['eviction notice', 'notice to quit', 'lease violation notice', 'rent increase notice'],
    },
    twists: [
      "Phrase reminders as 'what to do next' action items",
      "Add an 'is this notice even valid' checklist based on common defects",
      "Let users export the deadline to their phone's calendar",
    ],
  },
  {
    id: 'law-05',
    subject: 'law',
    difficulty: 'medium',
    text: 'Build a {tool} that compares a {document_type} clause-by-clause against {metric} to spot missing protections',
    vars: {
      tool: ['clause comparator', 'contract checker', 'interactive dashboard'],
      document_type: ['freelance contract', 'NDA', 'vendor agreement', 'roommate agreement'],
      metric: ['a standard industry template', 'a fairness checklist', 'a common red-flag clause list'],
    },
    twists: [
      'Add a redline view showing exactly what differs',
      'Add a plain-English risk score for the whole contract',
      "Let users save a personal 'must-have clauses' checklist to reuse",
    ],
  },
  {
    id: 'law-06',
    subject: 'law',
    difficulty: 'medium',
    text: 'Build a {tool} that checks whether a {metric} charged on a {document_type} looks unusually high for the going rate',
    vars: {
      tool: ['legality checker', 'fee auditor', 'mini web app'],
      metric: ['late fee', 'early termination fee', 'application fee', 'pet fee'],
      document_type: ['lease', 'rental agreement', 'sublease'],
    },
    twists: [
      'Add an editable fee-cap reference table users can fill in for their area',
      'Flag fees that stack in ways that seem excessive',
      "Add a 'draft a polite pushback email' generator",
    ],
  },
  {
    id: 'law-07',
    subject: 'law',
    difficulty: 'medium',
    text: 'Build a {tool} that auto-generates a {document_type} from a short questionnaire, with {metric} baked in',
    vars: {
      tool: ['contract automation tool', 'document generator', 'form-to-contract builder'],
      document_type: ['freelance agreement', 'roommate agreement', 'simple NDA', 'pet-sitting agreement'],
      metric: ['plain-English explanations for each clause', 'a built-in fairness checklist', 'editable boilerplate sections'],
    },
    twists: [
      'Add a live preview that updates as the questionnaire is filled out',
      "Let users toggle 'plain English' vs. 'formal legal' phrasing",
      'Add an export-to-PDF button with signature lines',
    ],
  },
  {
    id: 'law-08',
    subject: 'law',
    difficulty: 'medium',
    text: 'Build a {tool} that turns {metric} into an interactive compliance checklist for a {business_type}',
    vars: {
      tool: ['compliance checklist builder', 'audit tracker', 'mini web app'],
      metric: ['a set of local business regulations', 'data privacy requirements', 'workplace safety rules', 'accessibility requirements'],
      business_type: ['home bakery', 'freelance consultancy', 'small online shop', 'neighborhood pop-up'],
    },
    twists: [
      'Add progress tracking with a completion percentage',
      'Add due-date reminders for recurring compliance items',
      'Let users export a signed-off checklist as a printable report',
    ],
  },
  {
    id: 'law-09',
    subject: 'law',
    difficulty: 'hard',
    text: 'Build a {tool} that translates a full {document_type} into plain English, section by section, with {metric} highlighted',
    vars: {
      tool: ['plain-English translator', 'legal-doc decoder', 'interactive annotator'],
      document_type: ['terms of service', 'employment contract', 'apartment lease', 'insurance policy'],
      metric: ['clauses that waive your rights', 'auto-renewal traps', 'arbitration clauses', 'liability limitations'],
    },
    twists: [
      'Add a jargon glossary that builds itself as you translate more documents',
      'Add a side-by-side original vs. plain-English view',
      "Add a 'red flag summary' at the top of every document",
    ],
  },
  {
    id: 'law-10',
    subject: 'law',
    difficulty: 'hard',
    text: 'Build a {tool} that compares {metric} for tenants across {location_type}, sourced from public statutes',
    vars: {
      tool: ['tenant rights comparator', 'interactive dashboard', 'comparison map'],
      metric: ['eviction notice periods', 'security deposit limits', 'rent increase caps', 'habitability requirements'],
      location_type: ['a handful of states you pick', 'nearby cities', 'states from a dropdown'],
    },
    twists: [
      'Add a map view that color-codes tenant-friendliness',
      'Let users bookmark their state for a personalized quick-reference card',
      "Add a 'what changed recently' legislative update feed",
    ],
  },
  {
    id: 'law-11',
    subject: 'law',
    difficulty: 'hard',
    text: 'Build a {tool} that simulates negotiating a {document_type}, letting users practice pushing back on {metric}',
    vars: {
      tool: ['negotiation simulator', 'practice app', 'interactive role-play tool'],
      document_type: ['freelance contract', 'lease renewal', 'job offer letter', 'vendor agreement'],
      metric: ['a lowball rate', 'an unfair non-compete clause', 'a surprise fee', 'a one-sided termination clause'],
    },
    twists: [
      'Add scripted counterpart responses that adapt to what the user says',
      "Add a 'confidence score' that tracks how firmly the user negotiates",
      'Add a debrief screen listing clauses the user should have flagged',
    ],
  },
  {
    id: 'law-12',
    subject: 'law',
    difficulty: 'hard',
    text: 'Build a {tool} that aggregates {metric} into one dashboard for a {business_type}, sourced entirely from public filings and rules',
    vars: {
      tool: ['compliance dashboard', 'regulatory tracker', 'interactive dashboard'],
      metric: ['licensing renewal dates', 'tax filing deadlines', 'labor law requirements', 'zoning restrictions'],
      business_type: ['home bakery', 'food truck', 'freelance consultancy', 'small online shop'],
    },
    twists: [
      'Add color-coded urgency badges for upcoming deadlines',
      "Add a 'what happens if I miss this' explainer for each item",
      'Let users generate a printable annual compliance calendar',
    ],
  },
]

export const pack: SubjectPack = {
  subject: 'law',
  label: 'Law & Everyday Legal Literacy',
  templates,
  lenses: [
    'contract automation',
    'tenant rights',
    'compliance checklists',
    'legal-doc plain-English translator',
    'small-claims prep tools',
  ],
}
