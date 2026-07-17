// Serveur local / mono-hôte : sert l'API (app.js) + les fichiers statiques du
// build (dist/) et écoute sur un port. Utilisé par `npm run dev` et `npm run serve`.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import express from 'express'
import { app } from './app.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// En dev, l'API tourne sur son propre port (API_PORT) pour ne pas entrer en
// conflit avec le port du front injecté par l'environnement (PORT). En prod
// (npm run serve), un seul serveur écoute sur PORT.
const PORT = process.env.API_PORT || process.env.PORT || 3001

// Sert le build de production s'il existe.
const dist = join(__dirname, '..', 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`🍲 Recette Mate API sur http://localhost:${PORT}`)
})
