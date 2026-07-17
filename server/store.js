// Stockage à deux backends :
//  - Netlify Blobs quand l'app tourne sur Netlify (persistant, serverless) ;
//  - fichiers JSON sous data/ en local ou sur un hôte Node classique.
// Le bon backend est choisi automatiquement (repli sur fichiers si Blobs indispo).
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

// --- Sélection du backend ---
let blobsStore // undefined = non testé, null = indisponible, sinon = store
async function blobs() {
  if (blobsStore !== undefined) return blobsStore
  try {
    const { getStore } = await import('@netlify/blobs')
    const s = getStore('recette-mate')
    await s.get('__ping__') // déclenche l'erreur de config hors Netlify
    blobsStore = s
  } catch {
    blobsStore = null
  }
  return blobsStore
}

async function readDoc(key, fallback) {
  const s = await blobs()
  if (s) {
    const v = await s.get(key, { type: 'json' })
    return v ?? fallback
  }
  const file = join(DATA_DIR, key + '.json')
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeDoc(key, value) {
  const s = await blobs()
  if (s) {
    await s.setJSON(key, value)
    return
  }
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  await writeFile(join(DATA_DIR, key + '.json'), JSON.stringify(value, null, 2), 'utf8')
}

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function normalizeNutrition(x) {
  const o = x && typeof x === 'object' ? x : {}
  return {
    calories: String(o.calories || '').trim(),
    protein: String(o.protein || '').trim(),
    carbs: String(o.carbs || '').trim(),
    fat: String(o.fat || '').trim(),
  }
}

// ---- Recettes ----
const loadRecipes = () => readDoc('recipes', [])
const saveRecipes = (all) => writeDoc('recipes', all)

export async function listRecipes() {
  const all = await loadRecipes()
  return [...all].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function getRecipe(rid) {
  const all = await loadRecipes()
  return all.find((r) => r.id === rid) || null
}

export async function createRecipe(data) {
  const all = await loadRecipes()
  const now = Date.now()
  const recipe = {
    id: id(),
    title: data.title || 'Sans titre',
    servings: data.servings || '',
    prepTime: data.prepTime || '',
    cookTime: data.cookTime || '',
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    steps: Array.isArray(data.steps) ? data.steps : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    notes: data.notes || '',
    nutrition: normalizeNutrition(data.nutrition),
    image: data.image || '',
    source: data.source || '',
    author: data.author || '',
    createdAt: now,
    updatedAt: now,
  }
  all.push(recipe)
  await saveRecipes(all)
  return recipe
}

export async function updateRecipe(rid, data) {
  const all = await loadRecipes()
  const i = all.findIndex((r) => r.id === rid)
  if (i === -1) return null
  all[i] = { ...all[i], ...data, id: rid, updatedAt: Date.now() }
  await saveRecipes(all)
  return all[i]
}

export async function deleteRecipe(rid) {
  const all = await loadRecipes()
  const i = all.findIndex((r) => r.id === rid)
  if (i === -1) return false
  all.splice(i, 1)
  await saveRecipes(all)
  return true
}

// ---- Planning de la semaine ----
const EMPTY_PLAN = { selections: [], placements: [], extras: [], hideStaples: true }

function normalizePlan(p) {
  if (!p || typeof p !== 'object') return { ...EMPTY_PLAN }
  const extras = Array.isArray(p.extras) ? p.extras.map((x) => String(x)).filter(Boolean) : []
  const hideStaples = p.hideStaples === undefined ? true : !!p.hideStaples
  if (Array.isArray(p.selections) || Array.isArray(p.placements)) {
    return {
      selections: Array.isArray(p.selections) ? p.selections : [],
      placements: Array.isArray(p.placements) ? p.placements : [],
      extras,
      hideStaples,
    }
  }
  // Migration de l'ancien format { entries: [{day, meal, recipeId, portions}] }.
  if (Array.isArray(p.entries)) {
    const byRecipe = new Map()
    const placements = []
    for (const e of p.entries) {
      if (!e || !e.recipeId) continue
      byRecipe.set(e.recipeId, Math.max(byRecipe.get(e.recipeId) || 0, Number(e.portions) || 0))
      if (e.day && e.meal) placements.push({ day: e.day, meal: e.meal, recipeId: e.recipeId })
    }
    return {
      selections: [...byRecipe].map(([recipeId, portions]) => ({ recipeId, portions: portions || 2 })),
      placements,
      extras,
      hideStaples,
    }
  }
  return { ...EMPTY_PLAN }
}

export async function getPlan() {
  return normalizePlan(await readDoc('plan', { ...EMPTY_PLAN }))
}

export async function savePlan(plan) {
  const p = normalizePlan(plan)
  await writeDoc('plan', p)
  return p
}
