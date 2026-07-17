// Mise à l'échelle des quantités d'ingrédients selon un facteur de portions.

const UNICODE_FRAC: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
}

// Repère un nombre, une décimale, une fraction "1/2" ou une fraction unicode.
const NUM_TOKEN = /\d+\s*\/\s*\d+|\d+[.,]?\d*|[½¼¾⅓⅔⅛]/g

export function parseNum(token: string): number | null {
  const s = token.trim()
  if (UNICODE_FRAC[s] != null) return UNICODE_FRAC[s]
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac) {
    const b = Number(frac[2])
    return b ? Number(frac[1]) / b : null
  }
  const n = parseFloat(s.replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

// Formate un nombre en français : entier tel quel, sinon 2 décimales max, virgule.
export function formatNum(n: number): string {
  const rounded = Math.round(n * 100) / 100
  const s = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return s.replace('.', ',')
}

// Multiplie chaque nombre présent dans la quantité, en gardant les séparateurs
// (« 2 à 3 », « 1/2 »…). Renvoie la chaîne inchangée si aucun nombre.
export function scaleQuantity(quantity: string, factor: number): string {
  const q = quantity ?? ''
  if (!q.trim() || !Number.isFinite(factor) || factor <= 0) return q
  return q.replace(NUM_TOKEN, (tok) => {
    const n = parseNum(tok)
    return n == null ? tok : formatNum(n * factor)
  })
}

// Extrait le premier entier d'un champ portions libre ("4 pers." -> 4).
export function parseServings(servings: string | undefined): number | null {
  if (!servings) return null
  const m = servings.match(/\d+([.,]\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0].replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}
