# 🍲 Recette Mate

Carnet de recettes personnel : **saisie à la main** et **import depuis Instagram**.

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

Les recettes sont enregistrées dans `data/recipes.json` (créé au premier
enregistrement, ignoré par git). Pour repartir de zéro, supprimez ce fichier.

## Structure

```
server/
  index.js        API Express (CRUD + import) + service du build
  instagram.js    récupération + parsing des posts Instagram
  store.js        persistance JSON
src/
  App.tsx         navigation entre les vues
  components/     RecipeForm, RecipeList, RecipeDetail, InstagramImport
  api.ts, types.ts
```
