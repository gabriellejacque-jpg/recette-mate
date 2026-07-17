# Déploiement

Recette Mate est une app **full-stack** : un front React (statique après build) et
un backend **Express** qui sert l'API et stocke les données dans des fichiers JSON.
Un hébergeur **statique seul (Netlify, GitHub Pages…) ne suffit pas** : il faut un
serveur Node quelque part pour l'API.

Deux montages possibles.

---

## Option 1 — Tout-en-un sur un hébergeur Node (le plus simple)

Un seul service qui build le front puis lance Express (`npm run serve` sert à la
fois `dist/` et `/api`). Exemple avec **Render** :

- **Build command** : `npm install && npm run build`
- **Start command** : `npm run start`
- Le serveur écoute sur `process.env.PORT` (fourni par l'hôte) automatiquement.
- ⚠️ **Persistance** : ajoutez un **disque persistant** monté sur `data/`, sinon
  les recettes et le planning sont réinitialisés à chaque redéploiement (systèmes
  de fichiers éphémères par défaut).

Rien d'autre à configurer : le front appelle `/api` sur la même origine.

---

## Option 2 — Front sur Netlify + backend sur un hébergeur Node (montage actuel)

### a) Backend (API) sur Render / Railway / Fly.io

- **Build** : `npm install`
- **Start** : `npm run start` (lance `server/index.js` sur `process.env.PORT`)
- Variables d'env :
  - `CORS_ORIGIN` = l'URL de votre site Netlify (ex : `https://recette-mate.netlify.app`)
    pour n'autoriser que lui (sinon `*` par défaut).
- ⚠️ Même remarque sur le **disque persistant** monté sur `data/`.
- Notez l'URL publique obtenue, ex : `https://recette-mate-api.onrender.com`.

### b) Front sur Netlify

Le fichier [`netlify.toml`](netlify.toml) configure déjà `build = npm run build`
et `publish = dist`. Il reste **une** variable à définir dans Netlify
(**Site settings → Environment variables**) :

- `VITE_API_URL` = l'URL du backend de l'étape (a), ex :
  `https://recette-mate-api.onrender.com`

Puis redéployez le site (les variables Vite sont injectées **au build**, donc un
nouveau déploiement est nécessaire après avoir ajouté la variable).

Le front appellera alors le backend distant, et le backend l'autorisera via CORS.

---

## Pourquoi une page blanche sans build ?

Le `index.html` de la racine charge `/src/main.tsx` (entrée de développement, que
Vite transforme à la volée). En production il **faut** lancer `npm run build`, qui
génère `dist/` avec un `index.html` compilé. Sans build, le navigateur demande un
fichier `.tsx` inexistant → page blanche. `netlify.toml` s'en charge désormais.
