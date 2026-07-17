# 🍲 Recette Mate

**Recette Mate** est un carnet de recettes personnel doublé d'un outil de
préparation des menus de la semaine.

L'idée : centraliser ses recettes (tapées à la main **ou importées d'un post /
reel Instagram**), puis, en début de semaine, choisir celles qu'on va cuisiner et
obtenir automatiquement **une liste de courses rangée par rayon** — pensée pour
le *batch cooking* (cuisiner 2-3 plats en lot).

En bref, l'application permet de :

- 📝 **enregistrer des recettes** — saisie manuelle ou import depuis Instagram
  (la légende est analysée et découpée en ingrédients + étapes) ;
- 🥕 **structurer les ingrédients** en *quantité / unité / nom*, et **ajuster les
  portions** (les quantités se recalculent) ;
- 🔥 **suivre les valeurs nutritionnelles** par portion (saisies, extraites de la
  légende, ou estimées via la base CIQUAL de l'ANSES) ;
- 🗓️ **planifier la semaine** et **générer la liste de courses** agrégée et
  classée par rayon, avec exclusion des basiques déjà en stock et ajout d'articles
  hors recettes.

C'est une application web **React + Vite** (front) avec une petite **API Express**
(back) et un stockage sur fichiers JSON — pas de base de données, pas de compte :
tout tourne en local.

## Lancer le projet

```bash
npm install
npm run dev
```

- Front (Vite) : http://localhost:5180
- API (Express) : http://localhost:3001

En mode dev, le front proxifie `/api` vers le backend automatiquement.

### En production (un seul serveur)

```bash
npm run serve   # build + démarre Express qui sert le front et l'API sur :3001
```

### Déploiement en ligne

Configuré pour se déployer **entièrement sur Netlify** : front statique + API en
fonction serverless + données dans **Netlify Blobs** (aucune config, forfait Free
suffisant). Il suffit d'importer le repo dans Netlify.

Voir **[DEPLOY.md](DEPLOY.md)** pour le détail (et l'alternative « un seul serveur
Node » type Render/Railway).

## Fonctionnalités

- **Saisie manuelle** : titre, portions, temps de prépa/cuisson, ingrédients et étapes en listes dynamiques, tags, notes, photo.
- **Import Instagram** : collez le lien d'un post ou d'un reel. Le backend récupère la légende et la structure automatiquement en ingrédients + étapes. La recette pré-remplie est présentée dans le formulaire d'édition pour relecture avant enregistrement.
- **Repli manuel** : Instagram bloquant souvent l'accès sans connexion, un champ permet de coller la légende à la main — le même parseur la structure.
- **Consultation** : recherche par titre / tag / ingrédient, cases à cocher sur les ingrédients, étapes numérotées.

## Comment marche l'import Instagram

`server/instagram.js` tente deux stratégies pour lire un post public
(page `/embed/captioned/` puis page normale + balises Open Graph), puis
`parseCaptionToRecipe` détecte les sections « Ingrédients » / « Préparation »,
les listes à puces, les quantités (`200g`, `2 c. à soupe`…) et les hashtags.

> Instagram restreint fortement l'accès automatisé aux posts. Quand la
> récupération échoue, l'app bascule proprement sur le collage manuel de la
> légende, qui donne exactement le même résultat structuré.

## Planning de la semaine & liste de courses

Onglet **Planning**, pensé pour le batch cooking :

1. **Choisir des recettes** — une multi-sélection ajoute d'un coup les 2-3 recettes
   à cuisiner dans la semaine (pas de sélection répétée pour chaque repas).
2. **Portions à cuisiner** — un compteur par recette (par défaut = portions de la
   recette) définit la quantité à préparer en lot.
3. **Liste de courses** — agrège les ingrédients de la sélection, **mis à l'échelle**
   des portions, et les **regroupe par rayon** (fruits & légumes, boucherie,
   crémerie, féculents, épicerie, épices…). Cases à cocher + copier.
4. **Répartir sur la semaine** (optionnel) — une grille jours × repas où chaque
   créneau se remplit via un menu limité aux recettes déjà sélectionnées.

Le planning est persisté côté serveur (`data/plan.json`). Le classement par rayon
(`src/shopping.ts`) repose sur des mots-clés et reste approximatif.

## Valeurs nutritionnelles

Chaque recette peut porter des valeurs **par portion** (kcal, protéines, glucides,
lipides), saisies à la main, extraites de la légende Instagram si elle les
mentionne, ou **estimées automatiquement** depuis les ingrédients.

Le bouton « ✨ Estimer depuis les ingrédients » (formulaire) :

1. fait correspondre chaque ingrédient à un aliment de la table **CIQUAL**
   (`server/nutrition-db.json`) via un matching flou + une liste d'alias pour les
   aliments courants (`server/nutrition.js`) ;
2. convertit quantité + unité en grammes (masses, volumes, cuillères, pièces…) ;
3. somme puis divise par le nombre de portions.

Le résultat est **approximatif** (matching et conversions en grammes) et reste
librement modifiable. L'app indique combien d'ingrédients ont été reconnus et
lesquels ont été ignorés.

> Données : table de composition nutritionnelle **CIQUAL 2025** de l'ANSES
> (Agence nationale de sécurité sanitaire de l'alimentation), en accès libre.
> `server/nutrition-db.json` est un extrait (nom FR + énergie/protéines/glucides/
> lipides pour 100 g) régénéré depuis les fichiers officiels.

## Stockage

Tout est enregistré dans des fichiers JSON sous `data/` (créés à la première
utilisation, **ignorés par git** — les données restent donc locales) :

- `data/recipes.json` — les recettes ;
- `data/plan.json` — le planning de la semaine + la liste de courses.

Pour repartir de zéro, supprimez ces fichiers.

## Structure

```
server/
  index.js          API Express (CRUD recettes, import, planning, estimation) + service du build
  instagram.js      récupération + parsing des posts Instagram
  nutrition.js      matching des ingrédients sur la base CIQUAL + conversion en grammes
  nutrition-db.json extrait CIQUAL (≈3 200 aliments, valeurs pour 100 g)
  store.js          persistance JSON (recettes + planning)
src/
  App.tsx           navigation par onglets (Recettes / Planning)
  components/        RecipeForm, RecipeList, RecipeDetail, InstagramImport, Planner
  scale.ts           mise à l'échelle des quantités (fractions, plages…)
  shopping.ts        agrégation de la liste de courses + classement par rayon
  api.ts, types.ts
```
