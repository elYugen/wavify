// Serveur Node autonome : sert le build (dist/) et l'API. Usage : npm run build && npm start
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/api/')) {
    const out = await handleApi(u.pathname, u.searchParams);
    res.writeHead(out.status, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(out.json));
  }
  let file = normalize(join(dist, decodeURIComponent(u.pathname)));
  if (!file.startsWith(dist)) file = join(dist, 'index.html');
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(dist, 'index.html');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(process.env.PORT || 3000, () => console.log(`Wavify sur http://localhost:${process.env.PORT || 3000}`));
