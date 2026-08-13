import type { Proposal } from '../core/brief'

interface Props {
  proposal: Proposal
  loading: boolean
  onAccept: (option: string) => void
}

/**
 * The interview's staged next block. Nothing here is written to the Brief
 * until the user picks an option — a malformed proposal can be ignored.
 */
export default function ProposalCard({ proposal, loading, onAccept }: Props) {
  return (
    <div className="proposal-card" data-testid="proposal">
      <span className="block-label">{proposal.label}</span>
      <p className="proposal-question">{proposal.question}</p>
      <div className="proposal-options">
        {proposal.options.map((option) => (
          <button
            key={option}
            type="button"
            className="action-btn proposal-option"
            disabled={loading}
            onClick={() => onAccept(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
