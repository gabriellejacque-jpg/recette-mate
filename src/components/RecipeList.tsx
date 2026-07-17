import type { Recipe } from '../types'

interface Props {
  recipes: Recipe[]
  query: string
  onOpen: (id: string) => void
}

export default function RecipeList({ recipes, query, onOpen }: Props) {
  const q = query.trim().toLowerCase()
  const filtered = q
    ? recipes.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.ingredients.some((i) => i.toLowerCase().includes(q))
      )
    : recipes

  if (recipes.length === 0) {
    return (
      <div className="empty">
        <div className="empty-emoji">🍲</div>
        <h2>Aucune recette pour l'instant</h2>
        <p>Ajoutez votre première recette à la main ou importez-la depuis Instagram.</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return <div className="empty"><p>Aucune recette ne correspond à « {query} ».</p></div>
  }

  return (
    <div className="grid">
      {filtered.map((r) => (
        <button className="card" key={r.id} onClick={() => onOpen(r.id)}>
          <div className="card-media">
            {r.image ? (
              <img src={r.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <div className="card-placeholder">🍽️</div>
            )}
            {r.source && <span className="card-badge">Instagram</span>}
          </div>
          <div className="card-body">
            <h3>{r.title}</h3>
            <div className="card-meta">
              {r.servings && <span>👥 {r.servings}</span>}
              {r.prepTime && <span>⏱️ {r.prepTime}</span>}
              <span>🧾 {r.ingredients.length} ingr.</span>
            </div>
            {r.tags.length > 0 && (
              <div className="card-tags">
                {r.tags.slice(0, 3).map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
