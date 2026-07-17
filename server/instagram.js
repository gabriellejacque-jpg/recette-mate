// Récupération et parsing d'un post Instagram vers une recette structurée.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0 Safari/537.36'

export function normalizeInstagramUrl(input) {
  try {
    const u = new URL(input.trim())
    if (!/instagram\.com$/.test(u.hostname.replace(/^www\./, ''))) return null
    // Garde uniquement le chemin canonique /p/<code>/ ou /reel/<code>/
    const m = u.pathname.match(/\/(p|reel|tv)\/([^/]+)/)
    if (!m) return null
    return `https://www.instagram.com/${m[1]}/${m[2]}/`
  } catch {
    return null
  }
}

// Essaie plusieurs stratégies pour obtenir la légende + l'image d'un post public.
export async function fetchInstagramPost(url) {
  const strategies = [fetchViaEmbed, fetchViaPage]
  const errors = []
  for (const strat of strategies) {
    try {
      const res = await strat(url)
      if (res && res.caption) return res
    } catch (e) {
      errors.push(`${strat.name}: ${e.message}`)
    }
  }
  const err = new Error(
    "Impossible de récupérer automatiquement ce post (Instagram bloque souvent l'accès sans connexion). " +
      'Copiez-collez la légende du post dans le champ ci-dessous.'
  )
  err.details = errors
  throw err
}

async function fetchViaEmbed(url) {
  // La page /embed/captioned/ est plus permissive que la page normale.
  const embedUrl = url.replace(/\/$/, '') + '/embed/captioned/'
  const html = await get(embedUrl)
  return extractFromEmbedHtml(html)
}

async function fetchViaPage(url) {
  const html = await get(url)
  return extractFromPageHtml(html)
}

async function get(url) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 12000)
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        Accept: 'text/html',
      },
      signal: controller.signal,
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.text()
  } finally {
    clearTimeout(t)
  }
}

function decodeEntities(s) {
  if (!s) return ''
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
}

function extractFromEmbedHtml(html) {
  // La légende est dans un bloc .Caption ou dans le JSON "edge_media_to_caption".
  let caption = ''
  const jsonMatch = html.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"([\s\S]*?)"\}\}\]/)
  if (jsonMatch) caption = decodeEntities(jsonMatch[1])

  if (!caption) {
    const capBlock = html.match(/class="Caption"[\s\S]*?>([\s\S]*?)<\/div>/)
    if (capBlock) caption = decodeEntities(capBlock[1]).trim()
  }

  const image = extractImage(html)
  const author = extractAuthor(html)
  if (!caption) return null
  return { caption: caption.trim(), image, author }
}

function extractFromPageHtml(html) {
  let caption = ''
  const og = html.match(/<meta property="og:description" content="([^"]*)"/)
  if (og) caption = decodeEntities(og[1])

  const jsonMatch = html.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"([\s\S]*?)"\}\}\]/)
  if (jsonMatch) caption = decodeEntities(jsonMatch[1])

  const image = extractImage(html)
  const author = extractAuthor(html)
  if (!caption) return null
  return { caption: caption.trim(), image, author }
}

function extractImage(html) {
  const og = html.match(/<meta property="og:image" content="([^"]*)"/)
  if (og) return decodeEntities(og[1])
  const disp = html.match(/"display_url":"([^"]+)"/)
  if (disp) return decodeEntities(disp[1])
  return ''
}

function extractAuthor(html) {
  const m =
    html.match(/"owner":\{[^}]*"username":"([^"]+)"/) ||
    html.match(/@([A-Za-z0-9._]+)/)
  return m ? m[1] : ''
}

// ---- Parsing de la légende en recette structurée ----

const INGREDIENT_HEADERS =
  /^(ingr[ée]dients?|il (te|vous) faut|pour (la|le|les|l['’ ])|liste( des courses)?|la liste|shopping)\b/i
const STEPS_HEADERS =
  /^(pr[ée]paration|pr[ée]parer|pr[ée]pa|instructions?|[ée]tapes?|recette|m[ée]thode|marche à suivre|r[ée]alisation|montage|dressage|cuisson)\b/i
const BULLET = /^\s*([-–—•*·▪️▫️➡️👉🔸🔹✅✔️🥄🍽️⭐️▶️‣◦]+|\d+\s*[.)°]|[①②③④⑤⑥⑦⑧⑨⑩])\s*/
const NUMBERED = /^\s*(?:[eé]tape\s*)?(\d+\s*[.)°:-]|[①②③④⑤⑥⑦⑧⑨⑩])\s+/i

// Verbes de cuisine fréquents en début d'étape (infinitif ou impératif).
const STEP_VERB =
  /^(m[eé]lang(er|ez)|ajoute[rz]|verse[rz]|cui(re|se[rz])|faire|faites|coupe[rz]|[eé]mince[rz]|[eé]pluche[rz]|batt(re|ez)|incorpore[rz]|laisse[rz]|pr[eé]chauffe[rz]|enfourne[rz]|d[eé]pose[rz]|r[eé]serve[rz]|assaisonne[rz]|sale[rz]|poivre[rz]|fouette[rz]|p[eé]tri(r|ssez)|[eé]tale[rz]|nappe[rz]|serve[zr]|remue[rz]|chauffe[rz]|porte[rz]|retire[rz]|dispose[rz]|garni(r|ssez)|saupoudre[rz]|dresse[rz]|dore[rz]|mixe[rz]|rince[rz]|[eé]goutte[rz]|tranche[rz]|hache[rz]|r[aâ]pe[rz]|presse[rz]|monte[rz]|d[eé]glace[rz]|r[eé]dui(re|sez)|badigeonne[rz]|beurre[rz]|farine[rz]|d[eé]coupe[rz]|commence[rz]|d[eé]bute[rz]|prene[rz]|prendre|mette[rz]|mettre|[eé]crase[rz]|arrose[rz]|parseme[rz]|d[eé]core[rz]|enrobe[rz]|r[eé]chauffe[rz]|marine[rz]|casse[rz]|trempe[rz]|plonge[rz]|zeste[rz]|cisele[rz]|tamise[rz]|blanchi(r|ssez)|saisi(r|ssez)|rissole[rz]|caram[eé]lise[rz]|flambe[rz]|glace[rz]|d[eé]guste[rz]|couvre[rz]|couvrir|filme[rz]|d[eé]moule[rz]|passe[rz]|napper|foncer|fonce[rz]|d[eé]taille[rz])\b/i

const QTY =
  /(\d+[.,]?\d*)\s*(g|kg|ml|cl|dl|l|c\.?\s?[àa]\.?\s?[cs]|cuill[eè]res?|c\.?s|c\.?c|cs|cc|càs|càc|pinc[ée]es?|gousses?|tasses?|verres?|sachets?|œufs?|oeufs?|tranches?|pi[èe]ces?|grammes?|kilos?)\b/i

function stripHashtags(s) {
  return s.replace(/#[^\s#]+/g, '').trim()
}

function isNumbered(line) {
  return NUMBERED.test(line)
}

function looksLikeIngredient(line) {
  const l = line.replace(BULLET, '').trim()
  if (!l || l.length > 90) return false
  if (STEP_VERB.test(l)) return false
  // Quantité connue, puce, ou « nombre + aliment » sans unité (ex : « 2 avocats »).
  return (
    QTY.test(l) ||
    /^\s*[-–—•*·▪️🔸🔹]/.test(line) ||
    /^\d+([.,]\d+)?\s+\p{L}/u.test(line)
  )
}

function looksLikeStep(line) {
  const l = stripHashtags(line.replace(BULLET, '')).trim()
  if (!l) return false
  if (isNumbered(line)) return true
  if (STEP_VERB.test(l)) return true
  // Phrase d'instruction longue, sans marqueur de quantité.
  if (l.length > 55 && !QTY.test(l) && /\s/.test(l)) return true
  return false
}

// Unités reconnues pour isoler la quantité du nom de l'ingrédient.
const UNIT =
  /(?:kg|g|mg|ml|cl|dl|l|cuill[eè]res?(?:\s+[àa]\s+(?:soupe|caf[ée]))?|c\.?\s?[àa]\.?\s?(?:soupe|caf[ée]|s|c)\.?|càs|càc|c\.?\s?s\.?|c\.?\s?c\.?|pinc[ée]es?|gousses?|tasses?|verres?|sachets?|tranches?|pi[èe]ces?|grammes?|kilos?|litres?|feuilles?|brins?|bottes?|boules?|cubes?|morceaux?|louches?)/i

// Nombre / fraction / plage.
const NUM = '(?:\\d+\\s*\\/\\s*\\d+|\\d+[.,]?\\d*(?:\\s*(?:[-–à]|a)\\s*\\d+[.,]?\\d*)?|[½¼¾⅓⅔⅛])'

// Préfixe quantité : (1) nombre, (2) unité éventuelle, (3) nom.
const QTY_PREFIX = new RegExp(
  '^\\s*(' + NUM + ')\\s*(' + UNIT.source + ')?\\b\\s*(?:de\\s+|d[\'’]\\s*|des\\s+|du\\s+)?(.*)$',
  'i'
)

// Quantités exprimées en toutes lettres (sans chiffre).
const WORD_QTY =
  /^\s*(une? pinc[ée]e|une? poign[ée]e|un filet|un trait|un peu|quelques|une? gousse|une? botte|un bouquet|un morceau|une? branche)\s+(?:de\s+|d['’]\s*|des\s+|du\s+)?(.*)$/i

// Sépare "250g de farine" en { quantity: "250", unit: "g", name: "farine" }.
function splitIngredient(text) {
  const t = text.replace(BULLET, '').replace(/\s+/g, ' ').trim()
  if (!t) return { quantity: '', unit: '', name: '' }

  let m = t.match(QTY_PREFIX)
  if (m && m[1] && m[3] && m[3].trim()) {
    return {
      quantity: m[1].replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim(),
      unit: (m[2] || '').trim(),
      name: m[3].trim(),
    }
  }
  m = t.match(WORD_QTY)
  if (m && m[2] && m[2].trim()) {
    // Mesure en toutes lettres → placée dans l'unité (quantité laissée vide).
    return { quantity: '', unit: m[1].trim(), name: m[2].trim() }
  }
  return { quantity: '', unit: '', name: t }
}

// Une ligne de valeurs nutritionnelles (à extraire mais pas à ranger en étape).
function looksLikeNutrition(line) {
  const l = line.toLowerCase()
  if (!/\d/.test(l)) return false
  if (/\bk?cal\b|calories?/.test(l)) return true
  const labels = [/prot[ée]ines?|protein/, /glucides?|carb/, /lipides?|\bfats?\b|mati[èe]res? grasses/].filter(
    (re) => re.test(l)
  ).length
  return labels >= 2
}

// Extrait les valeurs nutritionnelles par portion si la légende les mentionne.
function parseNutrition(text) {
  const t = text.replace(/\s+/g, ' ')
  const num = (re) => {
    const m = t.match(re)
    return m ? m[1].replace(',', '.').replace(/\.0+$/, '') : ''
  }
  const first = (...res) => {
    for (const re of res) {
      const v = num(re)
      if (v) return v
    }
    return ''
  }

  const calories = first(
    /(\d+[.,]?\d*)\s*k?cal\b/i,
    /(?:calories?|[ée]nergie|kcal)\s*[:=]?\s*(\d+[.,]?\d*)/i
  )
  const protein = first(
    /(?:prot[ée]ines?|proteins?)\s*[:=]?\s*(\d+[.,]?\d*)\s*g?/i,
    /(\d+[.,]?\d*)\s*g\s*(?:de\s+)?prot[ée]ines?/i,
    /\bP\s*[:=]\s*(\d+[.,]?\d*)\s*g/i
  )
  const carbs = first(
    /(?:glucides?|carb(?:o?hydrates?|s)?)\s*[:=]?\s*(\d+[.,]?\d*)\s*g?/i,
    /(\d+[.,]?\d*)\s*g\s*(?:de\s+)?glucides?/i,
    /\bG\s*[:=]\s*(\d+[.,]?\d*)\s*g/i
  )
  const fat = first(
    /(?:lipides?|fats?|mati[èe]res?\s+grasses?)\s*[:=]?\s*(\d+[.,]?\d*)\s*g?/i,
    /(\d+[.,]?\d*)\s*g\s*(?:de\s+)?lipides?/i,
    /\bL\s*[:=]\s*(\d+[.,]?\d*)\s*g/i
  )

  return { calories, protein, carbs, fat }
}

// Éclate une ligne qui empile plusieurs étapes numérotées ("1. … 2. … 3. …").
function splitInlineNumbered(line) {
  const markers = line.match(/(?:^|\s)\d+\s*[.)]\s+\S/g)
  if (!markers || markers.length < 2) return [line]
  const parts = line
    .split(/\s(?=\d+\s*[.)]\s+\S)/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length >= 2 ? parts : [line]
}

export function parseCaptionToRecipe(caption, meta = {}) {
  const raw = caption.replace(/\r/g, '')
  let lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))

  // Titre : première ligne non vide et non-hashtag — retirée du corps ensuite,
  // sauf si c'est en réalité un en-tête de section.
  let title = ''
  let titleIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l && !l.startsWith('#')) {
      const t = stripHashtags(l).replace(BULLET, '').trim()
      if (t) {
        if (!INGREDIENT_HEADERS.test(t) && !STEPS_HEADERS.test(t)) {
          title = t
          titleIdx = i
        }
        break
      }
    }
  }
  if (title.length > 80) title = title.slice(0, 80).trim() + '…'

  // Hashtags -> tags
  const tags = [...new Set((raw.match(/#([\p{L}\p{N}_]+)/gu) || []).map((t) => t.slice(1)))].slice(0, 12)

  if (titleIdx >= 0) lines.splice(titleIdx, 1)
  // Découpe les lignes contenant plusieurs étapes numérotées.
  lines = lines.flatMap(splitInlineNumbered)

  const ingredients = []
  const steps = []
  let mode = 'none'

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue
    if (looksLikeNutrition(line)) continue // valeurs nutritionnelles : gérées à part
    const noBullet = line.replace(BULLET, '')

    // En-têtes de section (avec éventuel contenu sur la même ligne après « : »).
    if (INGREDIENT_HEADERS.test(noBullet)) {
      mode = 'ingredients'
      const after = noBullet.replace(INGREDIENT_HEADERS, '').replace(/^[\s:–—-]+/, '').trim()
      if (after && (QTY.test(after) || /^\d/.test(after))) {
        // Liste sur une seule ligne séparée par des virgules → items distincts.
        const items = after.includes(',') ? after.split(',').map((s) => s.trim()) : [after]
        ingredients.push(...items.filter(Boolean).map(splitIngredient))
      }
      continue
    }
    if (STEPS_HEADERS.test(noBullet)) {
      mode = 'steps'
      const after = noBullet.replace(STEPS_HEADERS, '').replace(/^[\s:–—-]+/, '').trim()
      if (after) steps.push(after)
      continue
    }

    const cleaned = stripHashtags(line).replace(BULLET, '').trim()
    if (!cleaned) continue

    if (mode === 'steps') {
      steps.push(cleaned)
    } else if (mode === 'ingredients') {
      // Bascule vers les étapes dès qu'une ligne ressemble clairement à une instruction.
      if (looksLikeStep(line) && !looksLikeIngredient(line)) {
        mode = 'steps'
        steps.push(cleaned)
      } else {
        ingredients.push(splitIngredient(cleaned))
      }
    } else {
      // Aucune section détectée : classification ligne par ligne.
      if (looksLikeStep(line) && !(isNumbered(line) && looksLikeIngredient(line))) {
        steps.push(cleaned)
      } else if (looksLikeIngredient(line)) {
        ingredients.push(splitIngredient(cleaned))
      }
    }
  }

  return {
    title: title || 'Recette importée',
    ingredients: ingredients.filter((i) => i && i.name),
    steps: steps.filter(Boolean),
    tags,
    notes: '',
    nutrition: parseNutrition(raw),
    image: meta.image || '',
    source: meta.source || '',
    author: meta.author || '',
  }
}
