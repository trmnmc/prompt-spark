import { useState } from 'react'

import type { Brief, Proposal } from '../core/brief'
import BlockRow from './BlockRow'
import ProposalCard from './ProposalCard'

interface Props {
  brief: Brief
  draft: string
  proposal: Proposal | null
  loading: boolean
  note: string | null
  onAccept: (option: string) => void
  onAddOwn: (label: string, answer: string) => void
  onEdit: (id: string, answer: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, toIndex: number) => void
  onFinish: () => void
}

/**
 * The board. Presentational by design — it owns no async state, so a stale
 * model call can never land in it. All model work lives in App, following
 * the same lift-state-up correction the scout view got in cycle 9.
 */
export default function BoardView({
  brief,
  draft,
  proposal,
  loading,
  note,
  onAccept,
  onAddOwn,
  onEdit,
  onRemove,
  onMove,
  onFinish,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')

  function submitOwn() {
    if (label.trim() === '' || detail.trim() === '') return
    onAddOwn(label.trim(), detail.trim())
    setLabel('')
    setDetail('')
    setAdding(false)
  }

  return (
    <section className="board">
      <div className="draft-panel">
        <span className="label">Your prompt so far</span>
        <p className="draft" data-testid="draft">
          {draft}
        </p>
      </div>

      {note && <p className="ai-note">{note}</p>}

      <ul className="block-list">
        {brief.blocks.map((block, index) => (
          <BlockRow
            key={block.id}
            block={block}
            index={index}
            total={brief.blocks.length}
            onEdit={onEdit}
            onRemove={onRemove}
            onMove={onMove}
          />
        ))}
      </ul>

      {proposal && <ProposalCard proposal={proposal} loading={loading} onAccept={onAccept} />}
      {loading && !proposal && <p className="ai-note">Thinking…</p>}

      {adding ? (
        <div className="add-block">
          <label className="add-field">
            Label
            <input
              className="block-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="add-field">
            Detail
            <input
              className="block-input"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
          <button type="button" className="action-btn" onClick={submitOwn}>
            Add
          </button>
        </div>
      ) : (
        <button type="button" className="action-btn add-block-btn" onClick={() => setAdding(true)}>
          + Add a block yourself
        </button>
      )}

      {brief.blocks.length > 0 && (
        <button type="button" className="action-btn finish-btn" onClick={onFinish}>
          Finish &amp; polish
        </button>
      )}
    </section>
  )
}
