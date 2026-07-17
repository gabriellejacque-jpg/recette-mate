// Fonction Netlify : expose l'API Express (server/app.js) en serverless.
// La redirection /api/* -> /.netlify/functions/api/:splat (netlify.toml) route
// les appels du front vers ici ; on normalise le chemin pour qu'Express voie /api/…
import serverless from 'serverless-http'
import { app } from '../../server/app.js'

const run = serverless(app)

export const handler = async (event, context) => {
  let path = event.path || '/'
  path = path.replace(/^\/\.netlify\/functions\/api/, '')
  if (!path.startsWith('/api')) path = '/api' + (path === '/' ? '' : path)
  event.path = path
  return run(event, context)
}
