import { useState } from 'react'

import type { Block } from '../core/brief'

interface Props {
  block: Block
  index: number
  total: number
  onEdit: (id: string, answer: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, toIndex: number) => void
}

/** One lego block: label, answer, and the controls that make it yours. */
export default function BlockRow({ block, index, total, onEdit, onRemove, onMove }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(block.answer)

  function save() {
    const next = value.trim()
    if (next !== '' && next !== block.answer) onEdit(block.id, next)
    setEditing(false)
  }

  return (
    <li className="block-row" data-testid="block-row">
      <span className="block-label">{block.label}</span>
      {editing ? (
        <input
          className="block-input"
          value={value}
          aria-label={`${block.label} answer`}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <span className="block-answer">{block.answer}</span>
      )}
      <span className="block-actions">
        <button
          type="button"
          className="action-btn"
          onClick={() => onMove(block.id, index - 1)}
          disabled={index === 0}
        >
          ↑<span className="sr-only"> move up</span>
        </button>
        <button
          type="button"
          className="action-btn"
          onClick={() => onMove(block.id, index + 1)}
          disabled={index === total - 1}
        >
          ↓<span className="sr-only"> move down</span>
        </button>
        {editing ? (
          <button type="button" className="action-btn" onClick={save}>
            Save
          </button>
        ) : (
          <button
            type="button"
            className="action-btn"
            onClick={() => {
              setValue(block.answer)
              setEditing(true)
            }}
          >
            Edit
          </button>
        )}
        <button type="button" className="action-btn" onClick={() => onRemove(block.id)}>
          Remove
        </button>
      </span>
    </li>
  )
}
