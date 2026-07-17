import { useState } from 'react'
import {
  emptyNutrition,
  nutritionToComma,
  nutritionToDot,
  type Ingredient,
  type Nutrition,
  type RecipeDraft,
} from '../types'
import { parseServings } from '../scale'
import { api } from '../api'

interface Props {
  initial: RecipeDraft
  submitLabel: string
  onSubmit: (draft: RecipeDraft) => void
  onCancel: () => void
}

interface EstimateFeedback {
  matched: number
  total: number
  unmatched: string[]
  portions: number
}

export default function RecipeForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<RecipeDraft>({
    ...initial,
    ingredients: initial.ingredients.length ? initial.ingredients : [{ quantity: '', unit: '', name: '' }],
    steps: initial.steps.length ? initial.steps : [''],
    nutrition: nutritionToComma(initial.nutrition ?? emptyNutrition()),
  })
  const [tagInput, setTagInput] = useState('')
  const [estimating, setEstimating] = useState(false)
  const [estimate, setEstimate] = useState<EstimateFeedback | null>(null)
  const [estimateError, setEstimateError] = useState('')

  function setNutrition(field: keyof Nutrition, value: string) {
    // N'autorise que chiffres et séparateur décimal (virgule ou point).
    const clean = value.replace(/[^0-9.,]/g, '')
    setDraft((d) => ({ ...d, nutrition: { ...(d.nutrition ?? emptyNutrition()), [field]: clean } }))
  }

  async function estimateNutrition() {
    setEstimateError('')
    setEstimate(null)
    const ingredients = draft.ingredients
      .map((i) => ({ quantity: i.quantity.trim(), unit: i.unit.trim(), name: i.name.trim() }))
      .filter((i) => i.name)
    if (!ingredients.length) {
      setEstimateError('Ajoutez d’abord des ingrédients.')
      return
    }
    const servings = parseServings(draft.servings) || 1
    setEstimating(true)
    try {
      const res = await api.estimateNutrition({ ingredients, servings })
      setDraft((d) => ({ ...d, nutrition: nutritionToComma(res.nutrition) }))
      setEstimate({
        matched: res.matchedCount,
        total: res.totalCount,
        unmatched: res.items.filter((i) => !i.used).map((i) => i.name),
        portions: res.portions,
      })
    } catch (e) {
      setEstimateError((e as Error).message)
    } finally {
      setEstimating(false)
    }
  }

  function set<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  // --- Ingrédients (quantité + nom) ---
  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    setDraft((d) => {
      const arr = d.ingredients.map((ing, idx) => (idx === i ? { ...ing, [field]: value } : ing))
      return { ...d, ingredients: arr }
    })
  }

  function addIngredient() {
    setDraft((d) => ({ ...d, ingredients: [...d.ingredients, { quantity: '', unit: '', name: '' }] }))
  }

  function removeIngredient(i: number) {
    setDraft((d) => {
      const arr = d.ingredients.filter((_, idx) => idx !== i)
      return { ...d, ingredients: arr.length ? arr : [{ quantity: '', unit: '', name: '' }] }
    })
  }

  // --- Étapes (texte) ---
  function updateStep(i: number, value: string) {
    setDraft((d) => {
      const arr = [...d.steps]
      arr[i] = value
      return { ...d, steps: arr }
    })
  }

  function addStep() {
    setDraft((d) => ({ ...d, steps: [...d.steps, ''] }))
  }

  function removeStep(i: number) {
    setDraft((d) => {
      const arr = d.steps.filter((_, idx) => idx !== i)
      return { ...d, steps: arr.length ? arr : [''] }
    })
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, '')
    if (t && !draft.tags.includes(t)) set('tags', [...draft.tags, t])
    setTagInput('')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      ...draft,
      title: draft.title.trim() || 'Sans titre',
      ingredients: draft.ingredients
        .map((i) => ({ quantity: i.quantity.trim(), unit: i.unit.trim(), name: i.name.trim() }))
        .filter((i) => i.name || i.quantity || i.unit),
      steps: draft.steps.map((s) => s.trim()).filter(Boolean),
      nutrition: nutritionToDot(draft.nutrition ?? emptyNutrition()),
    })
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>Titre</span>
        <input
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Ex : Curry de lentilles corail"
          autoFocus
        />
      </label>

      <div className="row-3">
        <label className="field">
          <span>Portions</span>
          <input value={draft.servings} onChange={(e) => set('servings', e.target.value)} placeholder="4 pers." />
        </label>
        <label className="field">
          <span>Préparation</span>
          <input value={draft.prepTime} onChange={(e) => set('prepTime', e.target.value)} placeholder="15 min" />
        </label>
        <label className="field">
          <span>Cuisson</span>
          <input value={draft.cookTime} onChange={(e) => set('cookTime', e.target.value)} placeholder="30 min" />
        </label>
      </div>

      <label className="field">
        <span>Image (URL, optionnel)</span>
        <input value={draft.image} onChange={(e) => set('image', e.target.value)} placeholder="https://…" />
      </label>

      <fieldset className="list-editor">
        <legend>Ingrédients</legend>
        <div className="ing-head">
          <span>Qté</span>
          <span>Unité</span>
          <span>Ingrédient</span>
        </div>
        {draft.ingredients.map((ing, i) => (
          <div className="ing-row" key={i}>
            <input
              className="ing-qty"
              value={ing.quantity}
              onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
              placeholder="200"
            />
            <input
              className="ing-unit"
              value={ing.unit}
              onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
              placeholder="g"
            />
            <input
              className="ing-name"
              value={ing.name}
              onChange={(e) => updateIngredient(i, 'name', e.target.value)}
              placeholder="farine"
            />
            <button type="button" className="icon-btn" onClick={() => removeIngredient(i)} aria-label="Supprimer">
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={addIngredient}>
          + Ajouter un ingrédient
        </button>
      </fieldset>

      <fieldset className="list-editor">
        <legend>Étapes</legend>
        {draft.steps.map((step, i) => (
          <div className="list-row" key={i}>
            <span className="step-num">{i + 1}</span>
            <textarea
              value={step}
              rows={2}
              onChange={(e) => updateStep(i, e.target.value)}
              placeholder="Faire revenir l'oignon…"
            />
            <button type="button" className="icon-btn" onClick={() => removeStep(i)} aria-label="Supprimer">
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={addStep}>
          + Ajouter une étape
        </button>
      </fieldset>

      <fieldset className="list-editor">
        <legend>Valeurs nutritionnelles (par portion)</legend>
        <div className="nutri-estimate">
          <button type="button" className="add-btn nutri-est-btn" onClick={estimateNutrition} disabled={estimating}>
            {estimating ? 'Estimation…' : '✨ Estimer depuis les ingrédients'}
          </button>
          <span className="hint">Basé sur la table CIQUAL (ANSES). Résultat approximatif, à vérifier.</span>
        </div>
        {estimateError && <div className="error-box">{estimateError}</div>}
        {estimate && (
          <div className="estimate-feedback">
            {estimate.matched}/{estimate.total} ingrédient(s) reconnus, pour {estimate.portions} portion(s).
            {estimate.unmatched.length > 0 && (
              <> Non pris en compte : {estimate.unmatched.join(', ')}.</>
            )}
          </div>
        )}
        <div className="nutri-grid">
          <label className="nutri-field">
            <span>Calories</span>
            <div className="nutri-input">
              <input
                type="text"
                inputMode="decimal"
                value={draft.nutrition?.calories ?? ''}
                onChange={(e) => setNutrition('calories', e.target.value)}
                placeholder="450"
              />
              <em>kcal</em>
            </div>
          </label>
          <label className="nutri-field">
            <span>Protéines</span>
            <div className="nutri-input">
              <input
                type="text"
                inputMode="decimal"
                value={draft.nutrition?.protein ?? ''}
                onChange={(e) => setNutrition('protein', e.target.value)}
                placeholder="20"
              />
              <em>g</em>
            </div>
          </label>
          <label className="nutri-field">
            <span>Glucides</span>
            <div className="nutri-input">
              <input
                type="text"
                inputMode="decimal"
                value={draft.nutrition?.carbs ?? ''}
                onChange={(e) => setNutrition('carbs', e.target.value)}
                placeholder="40"
              />
              <em>g</em>
            </div>
          </label>
          <label className="nutri-field">
            <span>Lipides</span>
            <div className="nutri-input">
              <input
                type="text"
                inputMode="decimal"
                value={draft.nutrition?.fat ?? ''}
                onChange={(e) => setNutrition('fat', e.target.value)}
                placeholder="15"
              />
              <em>g</em>
            </div>
          </label>
        </div>
      </fieldset>

      <label className="field">
        <span>Tags</span>
        <div className="tag-input">
          {draft.tags.map((t) => (
            <span className="tag" key={t}>
              #{t}
              <button type="button" onClick={() => set('tags', draft.tags.filter((x) => x !== t))}>
                ✕
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="végétarien, rapide…"
          />
        </div>
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea value={draft.notes} rows={3} onChange={(e) => set('notes', e.target.value)} placeholder="Astuces, variantes…" />
      </label>

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
