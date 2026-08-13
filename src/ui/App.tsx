import { useMemo, useRef, useState } from 'react'

import { AiError } from '../core/ai'
import {
  addBlock,
  createBrief,
  editBlock,
  moveBlock,
  removeBlock,
  type BlockKind,
  type Brief,
  type Proposal,
} from '../core/brief'
import { generate } from '../core/generate'
import {
  chipToProposal,
  makeAnthropicClient,
  polish,
  proposeNext,
  sketchOutcome,
  writeSentence,
  type Guess,
} from '../core/interview'
import { renderDraft, templateSentence } from '../core/render'
import { clearBrief, saveBrief, useBrief } from '../state/briefStore'
import { aiReady, useSettings } from '../state/settings'
import '../styles/app.css'
import BoardView from './BoardView'
import FavoritesView from './FavoritesView'
import PreviewPanel from './PreviewPanel'
import SeedForm from './SeedForm'
import SettingsPanel from './SettingsPanel'

type View = 'interview' | 'favorites'

/**
 * The preview gate's ephemeral state. Deliberately NOT persisted: a preview
 * describes the brief at briefUpdatedAt, and the render guard hides it the
 * moment the brief moves on. Re-previewing is two cheap calls.
 */
interface PreviewState {
  polished: string
  outcome: string | null
  guesses: Guess[]
  briefUpdatedAt: number
}

const TABS: { value: View; label: string }[] = [
  { value: 'interview', label: 'Interview' },
  { value: 'favorites', label: 'Favorites' },
]

/** Randomness lives only at this UI boundary — everything downstream is pure. */
function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

export default function App() {
  const [view, setView] = useState<View>('interview')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [copied, setCopied] = useState(false)

  const settings = useSettings()
  const brief = useBrief()

  // Every model call takes a ticket. A result whose ticket is stale — because
  // the user moved on, or flipped key/model mid-flight — is dropped rather
  // than landing in the board (the cycle-9 in-flight invalidation finding).
  const ticket = useRef(0)

  const draft = useMemo(() => (brief ? renderDraft(brief) : ''), [brief])

  /**
   * Every mutation goes through here. Persisting also drops any polished
   * output: a polish pass describes the brief as it was, so leaving it up
   * after an edit puts two contradictory prompts on screen at once.
   */
  function commit(next: Brief) {
    saveBrief(next)
    setPreview(null)
  }
  const client = useMemo(
    () =>
      aiReady(settings)
        ? makeAnthropicClient(settings.apiKey, settings.model, settings.baseUrl)
        : null,
    [settings],
  )

  async function askNext(current: Brief) {
    if (client === null) {
      setProposal(null)
      return
    }
    const mine = ++ticket.current
    setLoading(true)
    setNote(null)
    try {
      const next = await proposeNext(client, current)
      if (mine !== ticket.current) return
      setProposal(next)
    } catch (e) {
      if (mine !== ticket.current) return
      const err = e instanceof AiError ? e : new AiError('Unexpected error.', true)
      setNote(`${err.message} You can still add blocks yourself.`)
      setProposal(null)
    } finally {
      if (mine === ticket.current) setLoading(false)
    }
  }

  function handleStart(idea: string) {
    const fresh = createBrief(idea, Date.now())
    saveBrief(fresh)
    setProposal(null)
    setPreview(null)
    setNote(null)
    void askNext(fresh)
  }

  function handleSurprise(): string {
    return generate(randomSeed(), {}).text
  }

  async function handleAccept(option: string) {
    if (!brief || !proposal) return
    const mine = ++ticket.current
    setLoading(true)
    // Template sentence is the floor; with a key the model writes it properly.
    let sentence = templateSentence(proposal.kind, proposal.label, option)
    if (client !== null) {
      try {
        sentence = await writeSentence(client, brief, proposal.kind, proposal.label, option)
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError('Unexpected error.', true)
        setNote(`${err.message} Used a plain sentence instead.`)
      }
    }
    if (mine !== ticket.current) return
    const next = addBlock(
      brief,
      {
        kind: proposal.kind,
        label: proposal.label,
        question: proposal.question,
        answer: option,
        sentence,
      },
      Date.now(),
    )
    commit(next)
    setProposal(null)
    setLoading(false)
    void askNext(next)
  }

  function handleAddOwn(label: string, answer: string) {
    if (!brief) return
    const kind: BlockKind = 'custom'
    commit(
      addBlock(
        brief,
        { kind, label, question: null, answer, sentence: templateSentence(kind, label, answer) },
        Date.now(),
      ),
    )
  }

  function handleEdit(id: string, answer: string) {
    if (!brief) return
    const block = brief.blocks.find((b) => b.id === id)
    if (!block) return
    commit(
      editBlock(
        brief,
        id,
        { answer, sentence: templateSentence(block.kind, block.label, answer) },
        Date.now(),
      ),
    )
  }

  function handleRemove(id: string) {
    if (!brief) return
    commit(removeBlock(brief, id, Date.now()))
  }

  function handleMove(id: string, toIndex: number) {
    if (!brief) return
    commit(moveBlock(brief, id, toIndex, Date.now()))
  }

  async function handleFinish() {
    if (!brief) return
    const mine = ++ticket.current
    if (client === null) {
      setPreview({ polished: draft, outcome: null, guesses: [], briefUpdatedAt: brief.updatedAt })
      return
    }
    setLoading(true)
    setNote(null)
    // Polish and sketch are independent — run them together; each degrades alone.
    const [polishR, sketchR] = await Promise.allSettled([
      polish(client, draft),
      sketchOutcome(client, brief),
    ])
    if (mine !== ticket.current) return
    const polished = polishR.status === 'fulfilled' ? polishR.value : draft
    const outcome = sketchR.status === 'fulfilled' ? sketchR.value.outcome : null
    const guesses = sketchR.status === 'fulfilled' ? sketchR.value.guesses : []
    if (polishR.status === 'rejected' && sketchR.status === 'rejected') {
      setNote('Preview generation failed — showing the raw draft.')
    } else if (polishR.status === 'rejected') {
      setNote('Polish unavailable — this is the unpolished draft.')
    } else if (sketchR.status === 'rejected') {
      setNote('Outcome sketch unavailable.')
    }
    setPreview({ polished, outcome, guesses, briefUpdatedAt: brief.updatedAt })
    setLoading(false)
  }

  async function handleCopy() {
    if (!preview) return
    // A missing clipboard API is a FAILURE, not a silent success — optional
    // chaining alone would await undefined and claim "Copied!" without
    // copying (the success-gated-confirmation rule from the cycle-9 review).
    const clipboard = navigator.clipboard
    if (!clipboard?.writeText) {
      setNote('Copy failed — select the text manually.')
      return
    }
    try {
      await clipboard.writeText(preview.polished)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setNote('Copy failed — select the text manually.')
    }
  }

  async function handlePin(guess: Guess) {
    if (!brief || client === null) return
    const mine = ++ticket.current
    setLoading(true)
    try {
      const p = await chipToProposal(client, brief, guess)
      if (mine !== ticket.current) return
      setProposal(p)
      // Pinning re-opens the interview; the preview is now provisional.
      // (Deliberate spec deviation: keeping a stale preview up while the
      // user answers recreates the two-contradictory-artifacts problem
      // the gate exists to prevent.)
      setPreview(null)
    } catch (e) {
      if (mine !== ticket.current) return
      const err = e instanceof AiError ? e : new AiError('Unexpected error.', true)
      setNote(err.message)
    } finally {
      if (mine === ticket.current) setLoading(false)
    }
  }

  function handleStartOver() {
    ticket.current++
    clearBrief()
    setProposal(null)
    setPreview(null)
    setNote(null)
    setLoading(false)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Prompt Spark</h1>
        <button
          type="button"
          className="action-btn settings-toggle"
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          {aiReady(settings) ? '⚙︎ AI on' : '⚙︎ AI'}
        </button>
      </header>

      {settingsOpen && <SettingsPanel />}

      <nav className="tab-bar" aria-label="Sections">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={view === value ? 'tab-button tab-button--active' : 'tab-button'}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {view === 'interview' &&
          (brief === null ? (
            <SeedForm onStart={handleStart} onSurprise={handleSurprise} />
          ) : (
            <>
              <BoardView
                brief={brief}
                draft={draft}
                proposal={proposal}
                loading={loading}
                note={preview !== null ? null : note}
                onAccept={handleAccept}
                onAddOwn={handleAddOwn}
                onEdit={handleEdit}
                onRemove={handleRemove}
                onMove={handleMove}
                onFinish={handleFinish}
              />
              {preview !== null && preview.briefUpdatedAt === brief.updatedAt && (
                <PreviewPanel
                  polished={preview.polished}
                  outcome={preview.outcome}
                  guesses={preview.guesses}
                  note={note}
                  copied={copied}
                  onCopy={handleCopy}
                  onBack={() => setPreview(null)}
                  onPin={handlePin}
                />
              )}
              <button type="button" className="action-btn" onClick={handleStartOver}>
                Start over
              </button>
            </>
          ))}
        {view === 'favorites' && <FavoritesView />}
      </main>
    </div>
  )
}
