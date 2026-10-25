// Fonction serverless Vercel
import { handleApi } from '../server/api.js';

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const out = await handleApi('/api/spotify', u.searchParams);
  res.status(out.status).json(out.json);
}
