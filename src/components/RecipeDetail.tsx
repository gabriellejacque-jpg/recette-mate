import { useState } from 'react'
import type { Recipe } from '../types'
import { hasNutrition, toComma } from '../types'
import { parseServings, scaleQuantity } from '../scale'

interface Props {
  recipe: Recipe
  onEdit: () => void
  onDelete: () => void
}

export default function RecipeDetail({ recipe, onEdit, onDelete }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const baseServings = parseServings(recipe.servings)
  const [target, setTarget] = useState<number>(baseServings ?? 1)
  const factor = baseServings ? target / baseServings : 1
  const scaled = factor !== 1

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  // Affiche le champ portions en reflétant la cible choisie ("4 pers." -> "6 pers.").
  const servingsLabel =
    baseServings && recipe.servings
      ? recipe.servings.replace(/\d+([.,]\d+)?/, String(target))
      : recipe.servings

  return (
    <article className="detail">
      {recipe.image && (
        <div className="detail-hero">
          <img src={recipe.image} alt="" referrerPolicy="no-referrer" />
        </div>
      )}

      <div className="detail-head">
        <h1>{recipe.title}</h1>
        <div className="detail-actions">
          <button className="btn-ghost" onClick={onEdit}>
            ✏️ Modifier
          </button>
          <button className="btn-danger" onClick={onDelete}>
            🗑️ Supprimer
          </button>
        </div>
      </div>

      <div className="detail-meta">
        {servingsLabel && <span>👥 {servingsLabel}</span>}
        {recipe.prepTime && <span>⏱️ Prépa : {recipe.prepTime}</span>}
        {recipe.cookTime && <span>🔥 Cuisson : {recipe.cookTime}</span>}
      </div>

      {recipe.tags.length > 0 && (
        <div className="detail-tags">
          {recipe.tags.map((t) => (
            <span className="tag" key={t}>#{t}</span>
          ))}
        </div>
      )}

      <div className="detail-cols">
        <section>
          <h2>Ingrédients</h2>

          {baseServings && (
            <div className="portions">
              <span className="portions-label">Portions</span>
              <div className="stepper">
                <button
                  type="button"
                  onClick={() => setTarget((t) => Math.max(1, t - 1))}
                  aria-label="Diminuer"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                />
                <button type="button" onClick={() => setTarget((t) => t + 1)} aria-label="Augmenter">
                  +
                </button>
              </div>
              {scaled && (
                <button type="button" className="portions-reset" onClick={() => setTarget(baseServings)}>
                  ↺ {baseServings}
                </button>
              )}
            </div>
          )}

          {recipe.ingredients.length === 0 ? (
            <p className="muted">Aucun ingrédient renseigné.</p>
          ) : (
            <ul className="ingredients">
              {recipe.ingredients.map((ing, i) => {
                const qty = scaleQuantity(ing.quantity, factor)
                const measure = [qty, ing.unit].filter(Boolean).join(' ')
                return (
                  <li key={i} className={checked.has(i) ? 'done' : ''} onClick={() => toggle(i)}>
                    <span className="check">{checked.has(i) ? '✓' : ''}</span>
                    <span className="ing-text">
                      {measure && (
                        <strong className={'ing-qty-label' + (scaled ? ' scaled' : '')}>{measure}</strong>
                      )}
                      {ing.name}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <h2>Préparation</h2>
          {recipe.steps.length === 0 ? (
            <p className="muted">Aucune étape renseignée.</p>
          ) : (
            <ol className="steps">
              {recipe.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {hasNutrition(recipe.nutrition) && (
        <section className="nutrition">
          <h2>Valeurs nutritionnelles <small>par portion</small></h2>
          <div className="nutri-cards">
            {recipe.nutrition?.calories && (
              <div className="nutri-card nutri-cal">
                <span className="nutri-val">{toComma(recipe.nutrition.calories)}</span>
                <span className="nutri-unit">kcal</span>
              </div>
            )}
            {recipe.nutrition?.protein && (
              <div className="nutri-card">
                <span className="nutri-val">{toComma(recipe.nutrition.protein)} g</span>
                <span className="nutri-unit">Protéines</span>
              </div>
            )}
            {recipe.nutrition?.carbs && (
              <div className="nutri-card">
                <span className="nutri-val">{toComma(recipe.nutrition.carbs)} g</span>
                <span className="nutri-unit">Glucides</span>
              </div>
            )}
            {recipe.nutrition?.fat && (
              <div className="nutri-card">
                <span className="nutri-val">{toComma(recipe.nutrition.fat)} g</span>
                <span className="nutri-unit">Lipides</span>
              </div>
            )}
          </div>
        </section>
      )}

      {recipe.notes && (
        <section className="notes">
          <h2>Notes</h2>
          <p>{recipe.notes}</p>
        </section>
      )}

      {recipe.source && (
        <p className="source">
          Source :{' '}
          <a href={recipe.source} target="_blank" rel="noreferrer">
            {recipe.author ? `@${recipe.author}` : 'Instagram'} ↗
          </a>
        </p>
      )}
    </article>
  )
}
