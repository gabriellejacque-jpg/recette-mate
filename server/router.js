// Routeur d'API indépendant de tout framework : il prend (méthode, chemin, corps)
// et renvoie { status, body }. Utilisé par le serveur Express local (server/app.js)
// ET par la fonction Netlify (netlify/functions/api.mjs), sans dupliquer la logique.
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

async function importInstagram(body) {
  const { url, caption } = body

  if (caption && caption.trim()) {
    const recipe = parseCaptionToRecipe(caption, {
      source: normalizeInstagramUrl(url || '') || url || '',
    })
    return { status: 200, body: { recipe, mode: 'caption' } }
  }

  const canonical = normalizeInstagramUrl(url || '')
  if (!canonical) {
    return {
      status: 400,
      body: {
        error:
          "URL Instagram invalide. Collez un lien de post ou de reel (ex : https://www.instagram.com/p/XXXX/).",
      },
    }
  }

  try {
    const post = await fetchInstagramPost(canonical)
    const recipe = parseCaptionToRecipe(post.caption, {
      image: post.image,
      author: post.author,
      source: canonical,
    })
    return { status: 200, body: { recipe, mode: 'auto', caption: post.caption } }
  } catch (e) {
    return { status: 502, body: { error: e.message, details: e.details, needsCaption: true } }
  }
}

const NOT_FOUND = { status: 404, body: { error: 'Introuvable' } }

export async function route(method, path, body = {}) {
  // Recettes
  if (path === '/api/recipes') {
    if (method === 'GET') return { status: 200, body: await listRecipes() }
    if (method === 'POST') return { status: 201, body: await createRecipe(body) }
  }
  const m = path.match(/^\/api\/recipes\/([^/]+)$/)
  if (m) {
    const id = decodeURIComponent(m[1])
    if (method === 'GET') {
      const r = await getRecipe(id)
      return r ? { status: 200, body: r } : { status: 404, body: { error: 'Recette introuvable' } }
    }
    if (method === 'PUT') {
      const r = await updateRecipe(id, body)
      return r ? { status: 200, body: r } : { status: 404, body: { error: 'Recette introuvable' } }
    }
    if (method === 'DELETE') {
      const ok = await deleteRecipe(id)
      return ok ? { status: 204 } : { status: 404, body: { error: 'Recette introuvable' } }
    }
  }

  // Planning
  if (path === '/api/plan') {
    if (method === 'GET') return { status: 200, body: await getPlan() }
    if (method === 'PUT') return { status: 200, body: await savePlan(body) }
  }

  // Import Instagram
  if (path === '/api/import/instagram' && method === 'POST') return importInstagram(body)

  // Estimation nutritionnelle
  if (path === '/api/nutrition/estimate' && method === 'POST') {
    const { ingredients, servings } = body
    if (!Array.isArray(ingredients)) return { status: 400, body: { error: 'Liste d’ingrédients requise.' } }
    return { status: 200, body: estimateRecipe(ingredients, servings) }
  }

  return NOT_FOUND
}
