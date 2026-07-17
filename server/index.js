import express from 'express'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import {
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getPlan,
  savePlan,
} from './store.js'
import {
  normalizeInstagramUrl,
  fetchInstagramPost,
  parseCaptionToRecipe,
} from './instagram.js'
import { estimateRecipe } from './nutrition.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
// En dev, l'API tourne sur son propre port (API_PORT) pour ne pas entrer en
// conflit avec le port du front injecté par l'environnement (PORT). En prod
// (npm run serve), un seul serveur écoute sur PORT.
const PORT = process.env.API_PORT || process.env.PORT || 3001

app.use(express.json({ limit: '2mb' }))

// CORS : autorise le front (utile quand il est hébergé sur un autre domaine,
// ex : Netlify). CORS_ORIGIN peut restreindre à une origine précise ; défaut = *.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ---- API recettes ----
app.get('/api/recipes', async (_req, res) => {
  res.json(await listRecipes())
})

app.get('/api/recipes/:id', async (req, res) => {
  const r = await getRecipe(req.params.id)
  if (!r) return res.status(404).json({ error: 'Recette introuvable' })
  res.json(r)
})

app.post('/api/recipes', async (req, res) => {
  const r = await createRecipe(req.body || {})
  res.status(201).json(r)
})

app.put('/api/recipes/:id', async (req, res) => {
  const r = await updateRecipe(req.params.id, req.body || {})
  if (!r) return res.status(404).json({ error: 'Recette introuvable' })
  res.json(r)
})

app.delete('/api/recipes/:id', async (req, res) => {
  const ok = await deleteRecipe(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Recette introuvable' })
  res.status(204).end()
})

// ---- Import Instagram ----
// Deux modes : par URL (tentative de fetch auto) ou par légende collée à la main.
app.post('/api/import/instagram', async (req, res) => {
  const { url, caption } = req.body || {}

  // Mode 1 : l'utilisateur a collé une légende directement.
  if (caption && caption.trim()) {
    const recipe = parseCaptionToRecipe(caption, {
      source: normalizeInstagramUrl(url || '') || url || '',
    })
    return res.json({ recipe, mode: 'caption' })
  }

  // Mode 2 : tentative de récupération auto depuis l'URL.
  const canonical = normalizeInstagramUrl(url || '')
  if (!canonical) {
    return res.status(400).json({
      error:
        "URL Instagram invalide. Collez un lien de post ou de reel (ex : https://www.instagram.com/p/XXXX/).",
    })
  }

  try {
    const post = await fetchInstagramPost(canonical)
    const recipe = parseCaptionToRecipe(post.caption, {
      image: post.image,
      author: post.author,
      source: canonical,
    })
    res.json({ recipe, mode: 'auto', caption: post.caption })
  } catch (e) {
    res.status(502).json({ error: e.message, details: e.details, needsCaption: true })
  }
})

// ---- Planning de la semaine ----
app.get('/api/plan', async (_req, res) => {
  res.json(await getPlan())
})

app.put('/api/plan', async (req, res) => {
  res.json(await savePlan(req.body || { entries: [] }))
})

// ---- Estimation nutritionnelle (base CIQUAL / ANSES) ----
app.post('/api/nutrition/estimate', (req, res) => {
  const { ingredients, servings } = req.body || {}
  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'Liste d’ingrédients requise.' })
  }
  res.json(estimateRecipe(ingredients, servings))
})

// ---- Sert le build de production ----
const dist = join(__dirname, '..', 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`🍲 Recette Mate API sur http://localhost:${PORT}`)
})
