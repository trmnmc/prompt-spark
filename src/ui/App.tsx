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
import { makeAnthropicClient, polish, proposeNext, writeSentence } from '../core/interview'
import { renderDraft, templateSentence } from '../core/render'
import { clearBrief, saveBrief, useBrief } from '../state/briefStore'
import { aiReady, useSettings } from '../state/settings'
import '../styles/app.css'
import BoardView from './BoardView'
import FavoritesView from './FavoritesView'
import SeedForm from './SeedForm'
import SettingsPanel from './SettingsPanel'

type View = 'interview' | 'favorites'

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
  const [polished, setPolished] = useState<string | null>(null)

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
    setPolished(null)
  }
  const client = useMemo(
    () => (aiReady(settings) ? makeAnthropicClient(settings.apiKey, settings.model) : null),
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
    setPolished(null)
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
    if (client === null) {
      setPolished(draft)
      return
    }
    const mine = ++ticket.current
    setLoading(true)
    try {
      const smoothed = await polish(client, draft)
      if (mine !== ticket.current) return
      setPolished(smoothed)
    } catch {
      if (mine === ticket.current) setPolished(draft)
    } finally {
      if (mine === ticket.current) setLoading(false)
    }
  }

  function handleStartOver() {
    ticket.current++
    clearBrief()
    setProposal(null)
    setPolished(null)
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
                note={note}
                onAccept={handleAccept}
                onAddOwn={handleAddOwn}
                onEdit={handleEdit}
                onRemove={handleRemove}
                onMove={handleMove}
                onFinish={handleFinish}
              />
              {polished !== null && (
                <div className="polished-panel">
                  <span className="label">Polished</span>
                  <p className="draft" data-testid="polished">
                    {polished}
                  </p>
                </div>
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
