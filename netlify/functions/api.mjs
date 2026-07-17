// Fonction Netlify native (sans Express ni serverless-http, pour un bundling sûr).
// La redirection /api/* -> /.netlify/functions/api/:splat (netlify.toml) route ici ;
// on normalise le chemin puis on délègue au routeur partagé (server/router.js).
import { route } from '../../server/router.js'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type',
}

export const handler = async (event) => {
  // Normalise vers /api/… quelle que soit la forme reçue.
  let path = event.path || '/'
  path = path.replace(/^\/\.netlify\/functions\/api/, '')
  if (!path.startsWith('/api')) path = '/api' + (path === '/' ? '' : path)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  let body = {}
  if (event.body) {
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
      body = JSON.parse(raw)
    } catch {
      body = {}
    }
  }

  try {
    const r = await route(event.httpMethod, path, body)
    return {
      statusCode: r.status,
      headers: { 'content-type': 'application/json', ...CORS },
      body: r.status === 204 ? '' : JSON.stringify(r.body ?? null),
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json', ...CORS },
      body: JSON.stringify({ error: e.message }),
    }
  }
}
