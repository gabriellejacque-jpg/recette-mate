// Estimation nutritionnelle d'une recette à partir de la base CIQUAL (ANSES).
// Valeurs de la base : kcal / protéines / glucides / lipides pour 100 g.
// JSON importé et inliné par esbuild au bundling (aucun import.meta, aucune
// lecture disque au runtime). Node ≥ 22 accepte l'attribut en local.
import DB from './nutrition-db.json' with { type: 'json' }

const STOP = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'l', 'a', 'au', 'aux', 'en', 'et', 'ou',
  'avec', 'sans', 'bio', 'frais', 'fraiche', 'fraiches', 'nature', 'd', 'the', 'of',
])

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function singular(w) {
  return w.length > 4 ? w.replace(/(aux|eaux|s|x)$/i, (m) => (m === 'aux' || m === 'eaux' ? m[0] : '')) : w
}

function tokens(s) {
  return norm(s)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(singular)
    .filter(Boolean)
}

// Pré-normalisation des noms de la base (une fois, après définition des helpers).
const INDEX = DB.map((e) => ({ ...e, tokens: tokens(e.n), normName: norm(e.n) }))

// Aliments "de cuisine" fréquents → mots-clés de l'entrée générique visée.
// La cible est résolue en cherchant l'entrée la plus générique qui contient
// tous ces mots (voir resolveTarget). L'ordre va du plus spécifique au général.
const OVERRIDES = [
  ['farine', 'farine ble tendre t55'],
  ['oeuf', 'oeuf cru'],
  ['sucre glace', 'sucre glace'],
  ['sucre roux', 'sucre roux'],
  ['cassonade', 'sucre roux'],
  ['sucre', 'sucre blanc'],
  ['lait de coco', 'lait coco'],
  ['lait entier', 'lait entier uht'],
  ['lait', 'lait demi ecreme moyen'],
  ['beurre', 'beurre 80 doux'],
  ['huile olive', 'huile olive vierge extra'],
  ['huile tournesol', 'huile tournesol'],
  ['huile', 'huile olive vierge extra'],
  ['creme liquide', 'creme fluide uht'],
  ['creme fraiche', 'creme 30 mg fluide'],
  ['creme', 'creme 30 mg fluide'],
  ['oignon', 'oignon cru'],
  ['ail', 'ail cru'],
  ['tomate', 'tomate crue'],
  ['carotte', 'carotte crue'],
  ['pomme de terre', 'pomme terre sans peau crue'],
  ['riz', 'riz blanc cru'],
  ['pates', 'pates seches standard crues'],
  ['poulet', 'poulet filet sans peau cru'],
  ['citron', 'citron pulpe cru'],
  ['miel', 'miel'],
  ['chocolat noir', 'chocolat noir 50 cacao'],
  ['chocolat', 'chocolat tablette moyen'],
]

// Résout une cible (liste de mots) vers l'entrée la plus générique la contenant.
function resolveTarget(target) {
  const tt = tokens(target)
  const exact = INDEX.find((e) => e.normName === norm(target))
  if (exact) return exact
  let best = null
  let bestScore = Infinity
  for (const e of INDEX) {
    if (!tt.every((t) => e.tokens.includes(t))) continue
    const score = e.tokens.length - (/\bcru\b|\bcrue\b|\bcrues\b/.test(e.normName) ? 0.5 : 0)
    if (score < bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}

const PREP_PENALTY = /(preemball|farci|cuisine|gratin|poele|pane|sauce|plat |surgel|appertis|roti|grille|fourre|nappe|glace|frit|boite|puree|jus |soupe|salade|tarte|gateau)/

function findEntry(name) {
  const q = tokens(name)
  if (!q.length) return null
  const qset = new Set(q)
  // 1) overrides : tous les mots-clés doivent être des mots entiers du nom.
  for (const [key, target] of OVERRIDES) {
    if (tokens(key).every((t) => qset.has(t))) {
      const hit = resolveTarget(target)
      if (hit) return hit
    }
  }
  // 2) scoring flou
  const primary = q[0]
  let best = null
  let bestScore = -Infinity
  for (const e of INDEX) {
    if (!e.tokens.includes(primary)) continue
    const matched = q.filter((t) => e.tokens.includes(t)).length
    let score = (matched / q.length) * 100
    if (e.tokens[0] === primary) score += 25
    score -= e.tokens.length * 2.5
    if (/\bcru\b|\bcrue\b/.test(e.normName)) score += 10
    if (/aliment moyen/.test(e.normName)) score += 6
    if (PREP_PENALTY.test(e.normName)) score -= 15
    if (score > bestScore) {
      bestScore = score
      best = e
    }
  }
  return bestScore >= 40 ? best : null
}

// --- Conversion vers grammes ---
const MASS = { mg: 0.001, g: 1, gramme: 1, grammes: 1, kg: 1000, kilo: 1000, kilos: 1000 }
const VOLUME = { ml: 1, cl: 10, dl: 100, l: 1000, litre: 1000, litres: 1000 } // ~1 g/ml
const SPOON = 15 // c. à soupe
const TEASPOON = 5 // c. à café

// Poids moyen d'une pièce (g) selon des mots-clés du nom d'ingrédient.
const PIECE = [
  [/oeuf/, 50],
  [/oignon|onion/, 110],
  [/gousse|ail/, 5],
  [/tomate/, 120],
  [/carotte/, 80],
  [/pomme de terre|patate/, 150],
  [/citron|lime/, 100],
  [/pomme|orange|poire/, 150],
  [/banane/, 120],
  [/courgette/, 200],
  [/poivron/, 150],
  [/echalote/, 30],
  [/tranche/, 30],
  [/steak|escalope|filet/, 130],
]

function unitToGrams(quantity, unit, name) {
  const q = parseFloat(String(quantity).replace(',', '.'))
  if (!Number.isFinite(q) || q <= 0) return { grams: 0, approx: !!(quantity || unit) }
  const u = norm(unit)
  if (MASS[u] != null) return { grams: q * MASS[u], approx: false }
  if (VOLUME[u] != null) return { grams: q * VOLUME[u], approx: false }
  if (/c( a| \.|\.)?\s*s|cuillere.*soupe|càs|\bcs\b|soupe/.test(u)) return { grams: q * SPOON, approx: true }
  if (/c( a| \.|\.)?\s*c|cuillere.*cafe|càc|\bcc\b|cafe/.test(u)) return { grams: q * TEASPOON, approx: true }
  if (/pincee/.test(u)) return { grams: q * 1, approx: true }
  if (/sachet/.test(u)) return { grams: q * 8, approx: true }
  if (/tasse|verre|bol/.test(u)) return { grams: q * 200, approx: true }
  if (/gousse/.test(u)) return { grams: q * 5, approx: true }
  if (/tranche/.test(u)) return { grams: q * 30, approx: true }
  if (/boite|conserve|brique|pot/.test(u)) return { grams: q * 250, approx: true }
  // pas d'unité : on suppose un nombre de pièces
  if (!u) {
    const nn = norm(name)
    for (const [re, g] of PIECE) if (re.test(nn)) return { grams: q * g, approx: true }
    return { grams: q * 100, approx: true } // défaut prudent
  }
  return { grams: 0, approx: true }
}

export function estimateRecipe(ingredients, servings) {
  const portions = Number(servings) > 0 ? Number(servings) : 1
  let kcal = 0, p = 0, c = 0, f = 0
  const items = []
  for (const ing of ingredients || []) {
    if (!ing || !ing.name) continue
    const entry = findEntry(ing.name)
    const { grams, approx } = unitToGrams(ing.quantity, ing.unit, ing.name)
    if (!entry || !grams) {
      items.push({ name: ing.name, matched: entry ? entry.n : null, grams: Math.round(grams), used: false })
      continue
    }
    const k = grams / 100
    kcal += entry.kcal * k
    p += entry.p * k
    c += entry.c * k
    f += entry.f * k
    items.push({ name: ing.name, matched: entry.n, grams: Math.round(grams), approx, used: true })
  }
  const per = (x) => String(Math.round(x / portions))
  const per1 = (x) => String(Math.round((x / portions) * 10) / 10)
  return {
    portions,
    nutrition: { calories: per(kcal), protein: per1(p), carbs: per1(c), fat: per1(f) },
    items,
    matchedCount: items.filter((i) => i.used).length,
    totalCount: items.length,
  }
}
