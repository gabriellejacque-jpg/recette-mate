import { normalizeIngredient, normalizeNutrition, type Plan, type Recipe, type RecipeDraft } from './types'

function normalizeRecipe(r: Recipe): Recipe {
  return {
    ...r,
    ingredients: (r.ingredients || []).map(normalizeIngredient),
    nutrition: normalizeNutrition(r.nutrition),
  }
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Erreur ${res.status}`
    try {
      const body = await res.json()
      msg = body.error || msg
      const err = new Error(msg) as Error & { needsCaption?: boolean }
      err.needsCaption = body.needsCaption
      throw err
    } catch (e) {
      if (e instanceof Error && e.message !== msg) throw e
      throw new Error(msg)
    }
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  list: () => fetch('/api/recipes').then((r) => j<Recipe[]>(r)).then((rs) => rs.map(normalizeRecipe)),

  get: (id: string) => fetch(`/api/recipes/${id}`).then((r) => j<Recipe>(r)).then(normalizeRecipe),

  create: (data: RecipeDraft) =>
    fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => j<Recipe>(r)),

  update: (id: string, data: Partial<RecipeDraft>) =>
    fetch(`/api/recipes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => j<Recipe>(r)),

  remove: (id: string) =>
    fetch(`/api/recipes/${id}`, { method: 'DELETE' }).then((r) => j<void>(r)),

  getPlan: () => fetch('/api/plan').then((r) => j<Plan>(r)),

  savePlan: (plan: Plan) =>
    fetch('/api/plan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    }).then((r) => j<Plan>(r)),

  estimateNutrition: (payload: { ingredients: { quantity: string; unit: string; name: string }[]; servings: number }) =>
    fetch('/api/nutrition/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) =>
      j<{
        portions: number
        nutrition: { calories: string; protein: string; carbs: string; fat: string }
        items: { name: string; matched: string | null; grams: number; approx?: boolean; used: boolean }[]
        matchedCount: number
        totalCount: number
      }>(r)
    ),

  importInstagram: (payload: { url?: string; caption?: string }) =>
    fetch('/api/import/instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => j<{ recipe: RecipeDraft; mode: string; caption?: string }>(r))
      .then((res) => ({
        ...res,
        recipe: {
          ...res.recipe,
          ingredients: (res.recipe.ingredients || []).map(normalizeIngredient),
          nutrition: normalizeNutrition(res.recipe.nutrition),
        },
      })),
}
