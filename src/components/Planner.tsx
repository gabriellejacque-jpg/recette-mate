import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { DAYS, MEALS, type Placement, type Recipe, type WeekSelection } from '../types'
import { parseServings } from '../scale'
import { buildShoppingList, formatLine } from '../shopping'

interface Props {
  recipes: Recipe[]
}

export default function Planner({ recipes }: Props) {
  const [selections, setSelections] = useState<WeekSelection[]>([])
  const [placements, setPlacements] = useState<Placement[]>([])
  const [extras, setExtras] = useState<string[]>([])
  const [hideStaples, setHideStaples] = useState(true)
  const [loading, setLoading] = useState(true)
  const [picker, setPicker] = useState(false)
  const [showList, setShowList] = useState(false)

  const recipesById = useMemo(
    () => Object.fromEntries(recipes.map((r) => [r.id, r])),
    [recipes]
  )

  useEffect(() => {
    api
      .getPlan()
      .then((p) => {
        setSelections(p.selections || [])
        setPlacements(p.placements || [])
        setExtras(p.extras || [])
        setHideStaples(p.hideStaples !== false)
      })
      .finally(() => setLoading(false))
  }, [])

  function persist(patch: Partial<{ selections: WeekSelection[]; placements: Placement[]; extras: string[]; hideStaples: boolean }>) {
    const next = {
      selections: patch.selections ?? selections,
      placements: patch.placements ?? placements,
      extras: patch.extras ?? extras,
      hideStaples: patch.hideStaples ?? hideStaples,
    }
    setSelections(next.selections)
    setPlacements(next.placements)
    setExtras(next.extras)
    setHideStaples(next.hideStaples)
    api.savePlan(next).catch(() => {})
  }

  // --- Sélection (batch) ---
  function applySelection(checkedIds: string[]) {
    const set = new Set(checkedIds)
    const next: WeekSelection[] = checkedIds.map((id) => {
      const existing = selections.find((s) => s.recipeId === id)
      if (existing) return existing
      const r = recipesById[id]
      return { recipeId: id, portions: (r && parseServings(r.servings)) || 2 }
    })
    persist({ selections: next, placements: placements.filter((p) => set.has(p.recipeId)) })
    setPicker(false)
  }

  function setPortions(recipeId: string, portions: number) {
    persist({
      selections: selections.map((s) => (s.recipeId === recipeId ? { ...s, portions: Math.max(1, portions) } : s)),
    })
  }

  function removeSelection(recipeId: string) {
    persist({
      selections: selections.filter((s) => s.recipeId !== recipeId),
      placements: placements.filter((p) => p.recipeId !== recipeId),
    })
  }

  // --- Placement sur les repas (optionnel) ---
  function assign(day: string, meal: string, recipeId: string) {
    const others = placements.filter((p) => !(p.day === day && p.meal === meal))
    persist({ placements: recipeId ? [...others, { day, meal, recipeId }] : others })
  }

  function placementFor(day: string, meal: string) {
    return placements.find((p) => p.day === day && p.meal === meal)
  }

  // --- Liste de courses ---
  function addExtra(text: string) {
    const t = text.trim()
    if (t) persist({ extras: [...extras, t] })
  }
  function removeExtra(text: string) {
    const i = extras.indexOf(text)
    if (i >= 0) persist({ extras: extras.filter((_, idx) => idx !== i) })
  }

  const groups = useMemo(
    () => buildShoppingList(selections, recipesById, { extras, hideStaples }),
    [selections, recipesById, extras, hideStaples]
  )
  const totalPortions = selections.reduce((s, e) => s + e.portions, 0)

  if (loading) return <div className="empty"><p>Chargement…</p></div>

  if (recipes.length === 0) {
    return (
      <div className="empty">
        <div className="empty-emoji">🗓️</div>
        <h2>Aucune recette à planifier</h2>
        <p>Ajoutez d'abord des recettes, puis composez votre semaine ici.</p>
      </div>
    )
  }

  return (
    <div className="planner">
      <div className="planner-bar">
        <div className="planner-summary">
          {selections.length > 0 ? (
            <>
              <strong>{selections.length}</strong> recette(s) · <strong>{totalPortions}</strong> portion(s) à cuisiner
            </>
          ) : (
            <span className="muted">Choisissez les recettes que vous cuisinerez cette semaine.</span>
          )}
        </div>
        <div className="planner-actions">
          <button className="btn-ghost" onClick={() => setPicker(true)}>
            ＋ Choisir des recettes
          </button>
          <button className="btn-primary" disabled={selections.length === 0} onClick={() => setShowList(true)}>
            🛒 Liste de courses
          </button>
        </div>
      </div>

      {/* Sélection de la semaine */}
      {selections.length === 0 ? (
        <div className="week-empty">
          <p>🍳 Sélectionnez 2-3 recettes à cuisiner en lot, ajustez les portions, puis générez votre liste de courses.</p>
          <button className="btn-primary" onClick={() => setPicker(true)}>
            ＋ Choisir des recettes
          </button>
        </div>
      ) : (
        <div className="selection">
          {selections.map((s) => {
            const r = recipesById[s.recipeId]
            return (
              <div className="sel-card" key={s.recipeId}>
                <div className="sel-media">
                  {r?.image ? <img src={r.image} alt="" referrerPolicy="no-referrer" /> : '🍽️'}
                </div>
                <div className="sel-body">
                  <span className="sel-title">{r ? r.title : '(recette supprimée)'}</span>
                  <div className="sel-portions">
                    <div className="stepper mini">
                      <button onClick={() => setPortions(s.recipeId, s.portions - 1)} aria-label="Moins">−</button>
                      <span className="mini-val">{s.portions}</span>
                      <button onClick={() => setPortions(s.recipeId, s.portions + 1)} aria-label="Plus">+</button>
                    </div>
                    <span className="sel-port-label">portions à cuisiner</span>
                  </div>
                </div>
                <button className="entry-remove" onClick={() => removeSelection(s.recipeId)} aria-label="Retirer">
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Grille de la semaine (optionnelle) */}
      {selections.length > 0 && (
        <>
          <h2 className="planner-section">Répartir sur la semaine <small>(optionnel)</small></h2>
          <div className="week">
            {DAYS.map((day) => (
              <div className="day" key={day}>
                <h3 className="day-name">{day}</h3>
                <div className="day-meals">
                  {MEALS.map((meal) => {
                    const p = placementFor(day, meal)
                    const r = p ? recipesById[p.recipeId] : undefined
                    return (
                      <div className="meal" key={meal}>
                        <div className="meal-label">{meal}</div>
                        {p ? (
                          <div className="slot-filled">
                            <span>{r ? r.title : '(supprimée)'}</span>
                            <button className="entry-remove" onClick={() => assign(day, meal, '')} aria-label="Retirer">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <select
                            className="slot-select"
                            value=""
                            onChange={(e) => assign(day, meal, e.target.value)}
                          >
                            <option value="">＋ placer…</option>
                            {selections.map((s) => {
                              const sr = recipesById[s.recipeId]
                              return (
                                <option key={s.recipeId} value={s.recipeId}>
                                  {sr ? sr.title : s.recipeId}
                                </option>
                              )
                            })}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {picker && (
        <RecipePicker
          recipes={recipes}
          selectedIds={selections.map((s) => s.recipeId)}
          onCancel={() => setPicker(false)}
          onValidate={applySelection}
        />
      )}

      {showList && (
        <div className="overlay" onClick={() => setShowList(false)}>
          <div className="modal shopping" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>🛒 Liste de courses</h2>
              <button className="icon-btn" onClick={() => setShowList(false)}>✕</button>
            </div>
            <ShoppingList
              groups={groups}
              hideStaples={hideStaples}
              onToggleStaples={() => persist({ hideStaples: !hideStaples })}
              onAddExtra={addExtra}
              onRemoveExtra={removeExtra}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function RecipePicker({
  recipes,
  selectedIds,
  onCancel,
  onValidate,
}: {
  recipes: Recipe[]
  selectedIds: string[]
  onCancel: () => void
  onValidate: (ids: string[]) => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds))
  const [query, setQuery] = useState('')

  function toggle(id: string) {
    setChecked((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Recettes de la semaine</h2>
          <button className="icon-btn" onClick={onCancel}>✕</button>
        </div>
        <input
          className="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
        />
        <div className="picker-list">
          {filtered.map((r) => (
            <button
              key={r.id}
              className={checked.has(r.id) ? 'picker-item checked' : 'picker-item'}
              onClick={() => toggle(r.id)}
            >
              <span className="picker-check">{checked.has(r.id) ? '✓' : ''}</span>
              <span className="picker-thumb">
                {r.image ? <img src={r.image} alt="" referrerPolicy="no-referrer" /> : '🍽️'}
              </span>
              <span className="picker-name">{r.title}</span>
              {r.servings && <span className="picker-serv">{r.servings}</span>}
            </button>
          ))}
        </div>
        <div className="form-actions">
          <button className="btn-ghost" onClick={onCancel}>Annuler</button>
          <button className="btn-primary" onClick={() => onValidate([...checked])}>
            Valider ({checked.size})
          </button>
        </div>
      </div>
    </div>
  )
}

function ShoppingList({
  groups,
  hideStaples,
  onToggleStaples,
  onAddExtra,
  onRemoveExtra,
}: {
  groups: ReturnType<typeof buildShoppingList>
  hideStaples: boolean
  onToggleStaples: () => void
  onAddExtra: (text: string) => void
  onRemoveExtra: (text: string) => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [extraInput, setExtraInput] = useState('')

  function toggle(k: string) {
    setChecked((prev) => {
      const n = new Set(prev)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })
  }

  function submitExtra(e: React.FormEvent) {
    e.preventDefault()
    onAddExtra(extraInput)
    setExtraInput('')
  }

  function copy() {
    const text = groups
      .map((g) => g.aisle.toUpperCase() + '\n' + g.lines.map((l) => '- ' + formatLine(l)).join('\n'))
      .join('\n\n')
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {}
    )
  }

  return (
    <>
      <div className="shop-toolbar">
        <button type="button" className="staples-toggle" onClick={onToggleStaples}>
          <span className={hideStaples ? 'staples-box on' : 'staples-box'}>{hideStaples ? '✓' : ''}</span>
          J'ai déjà l'huile, le sel, le poivre
        </button>
        <button className="btn-ghost" onClick={copy} disabled={groups.length === 0}>
          {copied ? '✓ Copié' : '📋 Copier'}
        </button>
      </div>

      <form className="extra-add" onSubmit={submitExtra}>
        <input
          value={extraInput}
          onChange={(e) => setExtraInput(e.target.value)}
          placeholder="Ajouter un article (ex : essuie-tout, lait, éponges…)"
        />
        <button type="submit" className="btn-primary" disabled={!extraInput.trim()}>
          Ajouter
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="muted">Aucun article pour l'instant. Ajoutez des recettes ou un article ci-dessus.</p>
      ) : (
        <div className="shop-groups">
          {groups.map((g) => (
            <section className="shop-group" key={g.aisle}>
              <h3>{g.aisle}</h3>
              <ul>
                {g.lines.map((l, i) => {
                  const key = g.aisle + i
                  return (
                    <li key={key} className={checked.has(key) ? 'done' : ''}>
                      <span className="check" onClick={() => toggle(key)}>{checked.has(key) ? '✓' : ''}</span>
                      <span className="shop-line" onClick={() => toggle(key)}>
                        {formatLine(l)}
                        {l.manual && <span className="manual-tag">ajouté</span>}
                      </span>
                      {l.manual && (
                        <button className="entry-remove" onClick={() => onRemoveExtra(l.name)} aria-label="Retirer">
                          ✕
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
