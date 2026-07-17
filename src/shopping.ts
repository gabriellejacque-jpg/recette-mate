import type { Recipe, WeekSelection } from './types'
import { formatNum, parseNum, parseServings } from './scale'

export interface ShoppingLine {
  name: string
  unit: string
  quantity: number | null // null = quantité non chiffrable (ex : « sel »)
  fromRecipes: string[]
  manual?: boolean // article ajouté à la main
}

// Basiques supposés déjà en stock, exclus par défaut de la liste.
const STAPLES = /\bsel\b|\bpoivre\b|huile/

export interface AisleGroup {
  aisle: string
  lines: ShoppingLine[]
}

function normalize(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Rayons, dans l'ordre d'affichage ET de priorité de classement (1er match gagne).
const AISLES: { name: string; re: RegExp }[] = [
  {
    name: 'Fruits & légumes',
    re: /oignon|\bail\b|echalote|tomate|carotte|courgette|aubergine|poivron|champignon|salade|laitue|epinard|brocoli|chou|haricot vert|petit pois|pomme de terre|patate|citron|orange|pomme|poire|banane|fraise|framboise|avocat|concombre|radis|betterave|navet|poireau|celeri|persil|basilic|coriandre|menthe|ciboulette|gingembre|herbe|fenouil|courge|potiron|mais|ananas|mangue|raisin|melon|abricot|peche|cerise|kiwi/,
  },
  {
    name: 'Boucherie & poissonnerie',
    re: /poulet|dinde|boeuf|veau|porc|agneau|canard|jambon|lardon|bacon|saucisse|steak|escalope|viande|merguez|chorizo|saumon|thon|cabillaud|colin|crevette|poisson|moule|crustace|gambas|sardine|maquereau/,
  },
  {
    name: 'Crémerie & œufs',
    re: /lait\b|beurre|creme|fromage|yaourt|oeuf|parmesan|mozzarella|feta|gruyere|emmental|ricotta|mascarpone|chevre|comte|cheddar|margarine|lait de coco/,
  },
  {
    name: 'Féculents & pâtes',
    re: /\briz\b|pate|pates|spaghetti|nouille|lentille|pois chiche|haricot rouge|haricot blanc|quinoa|semoule|boulgour|farine|polenta|couscous|flocon/,
  },
  {
    name: 'Épicerie salée',
    re: /huile|olive\b|vinaigre|sauce soja|conserve|concentre|cornichon|tapenade|pesto|bouillon|cube|moutarde|ketchup|mayonnaise/,
  },
  {
    name: 'Épices & condiments',
    re: /\bsel\b|poivre|curry|cumin|paprika|cannelle|curcuma|muscade|piment|epice|herbes de provence|origan|thym|laurier|safran|noix de muscade|graine/,
  },
  {
    name: 'Sucré & pâtisserie',
    re: /sucre|chocolat|levure|vanille|miel|confiture|cacao|sirop|caramel|amande|noisette|\bnoix\b|praline|pepite|biscuit/,
  },
  { name: 'Boulangerie', re: /pain|baguette|brioche|viennoiserie|pate feuilletee|pate brisee|pate a pizza|tortilla|wrap/ },
  { name: 'Boissons', re: /\bvin\b|biere|\beau\b|\bjus\b|\bthe\b|cafe|limonade|soda/ },
]

export function aisleFor(name: string): string {
  const n = normalize(name)
  for (const a of AISLES) if (a.re.test(n)) return a.name
  return 'Autre'
}

// Agrège les ingrédients des recettes sélectionnées, mis à l'échelle des
// portions à cuisiner, puis regroupe par rayon.
export interface ShoppingOptions {
  extras?: string[]
  hideStaples?: boolean
}

export function buildShoppingList(
  selections: WeekSelection[],
  recipesById: Record<string, Recipe>,
  options: ShoppingOptions = {}
): AisleGroup[] {
  const map = new Map<
    string,
    { name: string; unit: string; sum: number; allNum: boolean; recipes: Set<string> }
  >()

  for (const entry of selections) {
    const recipe = recipesById[entry.recipeId]
    if (!recipe) continue
    const base = parseServings(recipe.servings) || entry.portions || 1
    const factor = entry.portions > 0 ? entry.portions / base : 1
    for (const ing of recipe.ingredients || []) {
      if (!ing.name) continue
      const key = normalize(ing.name) + '|' + normalize(ing.unit)
      let agg = map.get(key)
      if (!agg) {
        agg = { name: ing.name, unit: ing.unit, sum: 0, allNum: true, recipes: new Set() }
        map.set(key, agg)
      }
      agg.recipes.add(recipe.title)
      const n = parseNum(ing.quantity)
      if (n == null) agg.allNum = false
      else agg.sum += n * factor
    }
  }

  const byAisle = new Map<string, ShoppingLine[]>()
  const push = (aisle: string, line: ShoppingLine) => {
    if (!byAisle.has(aisle)) byAisle.set(aisle, [])
    byAisle.get(aisle)!.push(line)
  }

  for (const agg of map.values()) {
    // On saute les basiques supposés déjà en stock.
    if (options.hideStaples && STAPLES.test(normalize(agg.name))) continue
    push(aisleFor(agg.name), {
      name: agg.name,
      unit: agg.unit,
      quantity: agg.allNum ? Math.round(agg.sum * 10) / 10 : null,
      fromRecipes: [...agg.recipes],
    })
  }

  // Articles ajoutés à la main (jamais filtrés), classés par rayon.
  for (const text of options.extras || []) {
    const t = String(text).trim()
    if (!t) continue
    push(aisleFor(t), { name: t, unit: '', quantity: null, fromRecipes: [], manual: true })
  }

  const order = [...AISLES.map((a) => a.name), 'Autre']
  return order
    .filter((a) => byAisle.has(a))
    .map((aisle) => ({
      aisle,
      lines: byAisle.get(aisle)!.sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    }))
}

// Rendu texte d'une ligne : « 300 g farine », « 2 œufs », « sel ».
export function formatLine(line: ShoppingLine): string {
  const parts: string[] = []
  if (line.quantity != null && line.quantity > 0) parts.push(formatNum(line.quantity))
  if (line.unit) parts.push(line.unit)
  parts.push(line.name)
  return parts.join(' ')
}
