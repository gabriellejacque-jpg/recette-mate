# Déploiement

Recette Mate est une app **full-stack** (front React + API Express + stockage).
Elle est configurée pour se déployer **entièrement sur Netlify** : le front en
statique, l'API en **fonction serverless**, et les données dans **Netlify Blobs**.

## Déployer sur Netlify (recommandé)

Tout est déjà prêt dans le dépôt :

- [`netlify.toml`](netlify.toml) : build (`npm run build` → `dist/`), et redirection
  `/api/*` → la fonction ;
- [`netlify/functions/api.mjs`](netlify/functions/api.mjs) : l'API Express emballée
  en fonction (`serverless-http`) ;
- le stockage bascule automatiquement sur **Netlify Blobs** en ligne (et sur des
  fichiers `data/*.json` en local).

### Étapes

1. Sur Netlify : **Add new site → Import from Git** → choisir le repo
   `recette-mate`.
2. Laisser les réglages détectés (build `npm run build`, publish `dist`) — ils
   viennent du `netlify.toml`.
3. **Deploy**. C'est tout : aucune variable d'environnement requise, pas de backend
   séparé, pas de CORS à gérer (front et API sont sur le même domaine).

Les recettes et le planning sont stockés dans Netlify Blobs (persistant, inclus
dans le forfait **Free**).

### Bon à savoir (forfait Free)

- **Timeout des fonctions : 10 s.** L'import Instagram *automatique* (fetch d'une
  page externe) peut le dépasser → utilisez le repli « coller la légende », rapide.
- Léger *cold start* possible sur la première requête après inactivité (< 1 s).
- Quotas Free (≈125 k appels/mois, 100 h, 100 Go) : très au-delà d'un usage perso.

---

## Alternative — un seul serveur Node (Render, Railway, Fly.io…)

Si vous préférez un hôte Node classique, `npm run serve` build le front puis lance
Express qui sert `dist/` **et** l'API sur le même port :

- **Build** : `npm install && npm run build`
- **Start** : `npm run start`
- Le serveur écoute sur `process.env.PORT`.
- ⚠️ Montez un **disque persistant** sur `data/` (sinon les données sont
  réinitialisées à chaque redéploiement).

## Développement local

```bash
npm install
npm run dev      # front sur http://localhost:5180, API sur http://localhost:3001
```

En local, les données sont dans `data/*.json` (ignorés par git).

## Pourquoi une page blanche sans build ?

Le `index.html` de la racine charge `/src/main.tsx` (entrée de développement).
En production il **faut** builder (`npm run build`) pour générer `dist/` avec un
`index.html` compilé. `netlify.toml` s'en charge ; sans lui, un hébergeur qui sert
le dépôt brut renvoie une page blanche.
