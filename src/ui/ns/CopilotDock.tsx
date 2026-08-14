import { useState } from 'react'

interface Props {
  message: string | null
  thinking: boolean
}

/**
 * Advice with its reasoning attached, docked out of the way. The design's
 * rule is that the copilot explains WHY it recommends something and names
 * what would change its mind — never a bare instruction.
 */
export default function CopilotDock({ message, thinking }: Props) {
  const [open, setOpen] = useState(true)
  if (message === null && !thinking) return null

  return (
    <aside className="ns-copilot" data-testid="copilot">
      <button
        type="button"
        className="ns-copilot-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={thinking ? 'ns-dot ns-dot--thinking' : 'ns-dot'} />
        <span style={{ fontSize: 12, fontWeight: 600 }}>Copilot</span>
        <span style={{ marginLeft: 'auto', color: 'var(--ns-faint)', fontSize: 12 }}>
          {open ? '▾' : '▴'}
        </span>
      </button>
      {open && (
        <div className="ns-copilot-body" data-testid="copilot-body">
          {thinking && message === null ? 'Thinking…' : message}
        </div>
      )}
    </aside>
  )
}
