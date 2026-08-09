import { useState } from 'react'

import type { Filters } from '../core/types'
import '../styles/app.css'
import FilterBar from './FilterBar'
import SurpriseHero from './SurpriseHero'
import BrainScoutView from './BrainScoutView'
import FavoritesView from './FavoritesView'

type View = 'generator' | 'scout' | 'favorites'

const TABS: { value: View; label: string }[] = [
  { value: 'generator', label: 'Generator' },
  { value: 'scout', label: 'Brain Scout' },
  { value: 'favorites', label: 'Favorites' },
]

export default function App() {
  const [seed, setSeed] = useState<number | null>(null)
  const [filters, setFilters] = useState<Filters>({})
  const [view, setView] = useState<View>('generator')

  function handleSpark() {
    // Randomness lives here, at the UI boundary — everything downstream
    // (generate(), expand()) is a pure function of the seed it's given.
    setSeed(Math.floor(Math.random() * 2 ** 31))
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Prompt Spark</h1>
      </header>

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
        {view === 'generator' && <SurpriseHero seed={seed} onSpark={handleSpark} />}
        <FilterBar filters={filters} onChange={setFilters} />
        {view === 'scout' && <BrainScoutView />}
        {view === 'favorites' && <FavoritesView />}
      </main>
    </div>
  )
}
