// Stockage simple sur fichier JSON. Suffisant pour un carnet de recettes perso.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const DB_FILE = join(DATA_DIR, 'recipes.json')

function normalizeNutrition(x) {
  const o = x && typeof x === 'object' ? x : {}
  return {
    calories: String(o.calories || '').trim(),
    protein: String(o.protein || '').trim(),
    carbs: String(o.carbs || '').trim(),
    fat: String(o.fat || '').trim(),
  }
}

let cache = null

async function load() {
  if (cache) return cache
  if (!existsSync(DB_FILE)) {
    cache = []
    return cache
  }
  try {
    cache = JSON.parse(await readFile(DB_FILE, 'utf8'))
  } catch {
    cache = []
  }
  return cache
}

async function persist() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DB_FILE, JSON.stringify(cache, null, 2), 'utf8')
}

function id() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
}

export async function listRecipes() {
  const all = await load()
  return [...all].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function getRecipe(rid) {
  const all = await load()
  return all.find((r) => r.id === rid) || null
}

export async function createRecipe(data) {
  const all = await load()
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
  await persist()
  return recipe
}

export async function updateRecipe(rid, data) {
  const all = await load()
  const i = all.findIndex((r) => r.id === rid)
  if (i === -1) return null
  all[i] = { ...all[i], ...data, id: rid, updatedAt: Date.now() }
  await persist()
  return all[i]
}

export async function deleteRecipe(rid) {
  const all = await load()
  const i = all.findIndex((r) => r.id === rid)
  if (i === -1) return false
  all.splice(i, 1)
  await persist()
  return true
}

// ---- Planning de la semaine (document unique) ----
const PLAN_FILE = join(DATA_DIR, 'plan.json')
let planCache = null

const EMPTY_PLAN = { selections: [], placements: [], extras: [], hideStaples: true }

function normalizePlan(p) {
  if (!p || typeof p !== 'object') return { ...EMPTY_PLAN }
  const extras = Array.isArray(p.extras) ? p.extras.map((x) => String(x)).filter(Boolean) : []
  const hideStaples = p.hideStaples === undefined ? true : !!p.hideStaples
  // Nouveau format.
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
      const prev = byRecipe.get(e.recipeId) || 0
      byRecipe.set(e.recipeId, Math.max(prev, Number(e.portions) || 0))
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
  if (planCache) return planCache
  if (!existsSync(PLAN_FILE)) {
    planCache = { ...EMPTY_PLAN }
    return planCache
  }
  try {
    planCache = normalizePlan(JSON.parse(await readFile(PLAN_FILE, 'utf8')))
  } catch {
    planCache = { ...EMPTY_PLAN }
  }
  return planCache
}

export async function savePlan(plan) {
  planCache = normalizePlan(plan)
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  await writeFile(PLAN_FILE, JSON.stringify(planCache, null, 2), 'utf8')
  return planCache
}
