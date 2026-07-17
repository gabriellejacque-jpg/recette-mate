// App Express pour le développement local et l'hébergement mono-serveur Node.
// La logique des routes vit dans router.js (partagée avec la fonction Netlify).
import express from 'express'
import { route } from './router.js'

export const app = express()

app.use(express.json({ limit: '2mb' }))

// CORS (utile si le front est servi depuis un autre domaine).
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.all('/api/*', async (req, res) => {
  try {
    const r = await route(req.method, req.path, req.body || {})
    if (r.status === 204) return res.status(204).end()
    res.status(r.status).json(r.body)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
