/**
 * Favorites view stub. Real list rendering (favorited prompts + scout
 * results, backed by localStorage) lands in a later item.
 */
export default function FavoritesView() {
  return (
    <section className="favorites-view">
      <h2>Favorites</h2>
      <div className="empty-state">No favorites yet</div>
    </section>
  )
}
