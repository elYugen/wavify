// Fonction serverless Vercel
import { handleApi } from '../server/api.js';

export default async function handler(req, res) {
  const out = await handleApi('/api/spotify-status', new URLSearchParams());
  res.status(out.status).json(out.json);
}
