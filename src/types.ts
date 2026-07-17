export interface Ingredient {
  quantity: string
  unit: string
  name: string
}

// Valeurs nutritionnelles par portion (kcal + macros en grammes).
export interface Nutrition {
  calories: string
  protein: string
  carbs: string
  fat: string
}

export interface Recipe {
  id: string
  title: string
  servings?: string
  prepTime?: string
  cookTime?: string
  ingredients: Ingredient[]
  steps: string[]
  tags: string[]
  notes?: string
  nutrition?: Nutrition
  image?: string
  source?: string
  author?: string
  createdAt?: number
  updatedAt?: number
}

export type RecipeDraft = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>

// ---- Planning de la semaine (batch cooking) ----
// La semaine tourne autour de quelques recettes cuisinées en lot.
export interface WeekSelection {
  recipeId: string
  portions: number // nombre de portions à cuisiner (batch)
}

export interface Placement {
  day: string
  meal: string
  recipeId: string
}

export interface Plan {
  selections: WeekSelection[]
  placements: Placement[]
  extras: string[] // articles ajoutés à la main à la liste de courses
  hideStaples: boolean // masquer les basiques déjà en stock (huile, sel, poivre)
}

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const MEALS = ['Déjeuner', 'Dîner']

// Accepte l'ancien format (chaîne) comme le nouveau (objet) pour rester
// compatible avec des recettes enregistrées avant ce changement.
export function normalizeIngredient(x: unknown): Ingredient {
  if (x && typeof x === 'object') {
    const o = x as Partial<Ingredient>
    return {
      quantity: (o.quantity || '').trim(),
      unit: (o.unit || '').trim(),
      name: (o.name || '').trim(),
    }
  }
  return { quantity: '', unit: '', name: String(x ?? '').trim() }
}

export function emptyNutrition(): Nutrition {
  return { calories: '', protein: '', carbs: '', fat: '' }
}

export function normalizeNutrition(x: unknown): Nutrition {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<Nutrition>
  return {
    calories: (o.calories || '').trim(),
    protein: (o.protein || '').trim(),
    carbs: (o.carbs || '').trim(),
    fat: (o.fat || '').trim(),
  }
}

export function hasNutrition(n: Nutrition | undefined): boolean {
  return !!n && (!!n.calories || !!n.protein || !!n.carbs || !!n.fat)
}

// Affichage FR (virgule) ↔ stockage canonique (point).
export const toComma = (s: string) => (s || '').replace('.', ',')
export const toDot = (s: string) => (s || '').replace(',', '.')

function mapNutrition(n: Nutrition, fn: (v: string) => string): Nutrition {
  return { calories: fn(n.calories), protein: fn(n.protein), carbs: fn(n.carbs), fat: fn(n.fat) }
}
export const nutritionToComma = (n: Nutrition): Nutrition => mapNutrition(n, toComma)
export const nutritionToDot = (n: Nutrition): Nutrition => mapNutrition(n, toDot)

export function emptyDraft(): RecipeDraft {
  return {
    title: '',
    servings: '',
    prepTime: '',
    cookTime: '',
    ingredients: [{ quantity: '', unit: '', name: '' }],
    steps: [''],
    tags: [],
    notes: '',
    nutrition: emptyNutrition(),
    image: '',
    source: '',
    author: '',
  }
}
