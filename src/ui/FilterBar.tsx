import type { Difficulty, Filters, Subject } from '../core/types'

/** Ordered subject chip definitions: value + label. */
const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'realEstate', label: 'Real Estate' },
  { value: 'law', label: 'Law' },
  { value: 'finance', label: 'Finance' },
  { value: 'science', label: 'Science' },
]

/** Ordered difficulty chip definitions: value + label. */
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export interface FilterBarProps {
  filters: Filters
  onChange: (filters: Filters) => void
}

/**
 * Subject + difficulty chip row. Conjunctive semantics: an undefined
 * field means "match anything" for that dimension. Tapping the active
 * chip (or the "All"/"Any" chip) clears that dimension back to undefined.
 */
export default function FilterBar({ filters, onChange }: FilterBarProps) {
  function toggleSubject(subject: Subject) {
    onChange({
      ...filters,
      subject: filters.subject === subject ? undefined : subject,
    })
  }

  function toggleDifficulty(difficulty: Difficulty) {
    onChange({
      ...filters,
      difficulty: filters.difficulty === difficulty ? undefined : difficulty,
    })
  }

  return (
    <div className="filter-bar" role="group" aria-label="Filters">
      <div className="filter-row" role="group" aria-label="Subject">
        <button
          type="button"
          className={
            filters.subject === undefined ? 'filter-chip filter-chip--active' : 'filter-chip'
          }
          aria-pressed={filters.subject === undefined}
          onClick={() => onChange({ ...filters, subject: undefined })}
        >
          All
        </button>
        {SUBJECTS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={
              filters.subject === value ? 'filter-chip filter-chip--active' : 'filter-chip'
            }
            aria-pressed={filters.subject === value}
            onClick={() => toggleSubject(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="filter-row" role="group" aria-label="Difficulty">
        <button
          type="button"
          className={
            filters.difficulty === undefined ? 'filter-chip filter-chip--active' : 'filter-chip'
          }
          aria-pressed={filters.difficulty === undefined}
          onClick={() => onChange({ ...filters, difficulty: undefined })}
        >
          Any
        </button>
        {DIFFICULTIES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={
              filters.difficulty === value ? 'filter-chip filter-chip--active' : 'filter-chip'
            }
            aria-pressed={filters.difficulty === value}
            onClick={() => toggleDifficulty(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
