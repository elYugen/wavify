// Backend minimal partagé (Vite dev, serveur Node autonome et fonctions Vercel).
// Aucune clé API obligatoire : recherche YouTube via InnerTube, SoundCloud via son API web,
// Audius via son API ouverte, Spotify via la page "embed" publique.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const AUDIUS_APP = 'wavify-pwa';

const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.p;
  const p = fn().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, { t: Date.now(), p });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return p;
}

function parseClock(text) {
  if (!text) return 0;
  return String(text)
    .split(':')
    .reduce((acc, part) => acc * 60 + (parseInt(part, 10) || 0), 0);
}

function textOf(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.simpleText) return node.simpleText;
  if (node.runs) return node.runs.map((r) => r.text).join('');
  if (node.content) return node.content;
  return '';
}

function collect(obj, key, out = []) {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    for (const v of obj) collect(v, key, out);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === key) out.push(v);
    else collect(v, key, out);
  }
  return out;
}

/* ----------------------------- YouTube ----------------------------- */

function mapVideoRenderers(data) {
  const seen = new Set();
  return collect(data, 'videoRenderer')
    .filter((v) => v?.videoId && v.lengthText && !seen.has(v.videoId) && seen.add(v.videoId))
    .map((v) => ({
      source: 'youtube',
      sourceId: v.videoId,
      title: textOf(v.title),
      artist: textOf(v.ownerText || v.longBylineText || v.shortBylineText).replace(/ - Topic$/, ''),
      duration: parseClock(textOf(v.lengthText)),
      artwork: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
    }));
}

async function youtubeOfficial(q, key) {
  const s = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=25&q=${encodeURIComponent(q)}&key=${key}`,
  ).then((r) => r.json());
  const ids = (s.items || []).map((i) => i.id.videoId).join(',');
  if (!ids) return [];
  const d = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${ids}&key=${key}`,
  ).then((r) => r.json());
  return (d.items || []).map((v) => {
    const m = v.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
    return {
      source: 'youtube',
      sourceId: v.id,
      title: v.snippet.title,
      artist: v.snippet.channelTitle.replace(/ - Topic$/, ''),
      duration: (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0),
      artwork: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${v.id}`,
    };
  });
}

async function youtubeInnertube(q) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, Cookie: 'SOCS=CAI' },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20251020.01.00', hl: 'fr', gl: 'FR' } },
      query: q,
      params: 'EgIQAQ==', // filtre "vidéos uniquement"
    }),
  });
  if (!res.ok) throw new Error(`InnerTube ${res.status}`);
  return mapVideoRenderers(await res.json());
}

async function youtubeHtml(q) {
  const html = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D&hl=fr`,
    { headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9', Cookie: 'SOCS=CAI; CONSENT=YES+cb' } },
  ).then((r) => r.text());
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) throw new Error('ytInitialData introuvable');
  return mapVideoRenderers(JSON.parse(m[1]));
}

export async function searchYouTube(q) {
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    try {
      return await youtubeOfficial(q, key);
    } catch {
      /* repli sans clé */
    }
  }
  try {
    const r = await youtubeInnertube(q);
    if (r.length) return r;
  } catch {
    /* repli HTML */
  }
  return youtubeHtml(q);
}

/* ---------------------------- SoundCloud ---------------------------- */

function soundcloudClientId() {
  if (process.env.SOUNDCLOUD_CLIENT_ID) return Promise.resolve(process.env.SOUNDCLOUD_CLIENT_ID);
  return cached('sc:client_id', 6 * 3600e3, async () => {
    const html = await fetch('https://soundcloud.com/', { headers: { 'User-Agent': UA } }).then((r) => r.text());
    const scripts = [...html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)]
      .map((m) => m[1])
      .reverse();
    for (const src of scripts) {
      const js = await fetch(src, { headers: { 'User-Agent': UA } }).then((r) => r.text());
      const m = js.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{32})"/) || js.match(/client_id=([a-zA-Z0-9]{32})/);
      if (m) return m[1];
    }
    throw new Error('client_id SoundCloud introuvable');
  });
}

function scArtwork(t) {
  const u = t.artwork_url || t.user?.avatar_url || '';
  return u.replace('-large.', '-t500x500.');
}

export async function searchSoundCloud(q) {
  const cid = await soundcloudClientId();
  const res = await fetch(
    `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&client_id=${cid}&limit=30`,
    { headers: { 'User-Agent': UA } },
  );
  if (res.status === 401 || res.status === 403) cache.delete('sc:client_id');
  if (!res.ok) throw new Error(`SoundCloud ${res.status}`);
  const data = await res.json();
  return (data.collection || [])
    .filter((t) => t.streamable !== false && t.policy !== 'BLOCK' && t.policy !== 'SNIP')
    .map((t) => ({
      source: 'soundcloud',
      sourceId: String(t.id),
      title: t.title,
      artist: t.publisher_metadata?.artist || t.user?.username || '',
      duration: Math.round((t.full_duration || t.duration || 0) / 1000),
      artwork: scArtwork(t),
      url: t.permalink_url,
    }));
}

/* ------------------------------ Audius ------------------------------ */

const AUDIUS_HOST = 'https://api.audius.co';

export async function searchAudius(q) {
  const res = await fetch(
    `${AUDIUS_HOST}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=${AUDIUS_APP}`,
    { headers: { 'User-Agent': UA } },
  );
  if (!res.ok) throw new Error(`Audius ${res.status}`);
  const { data = [] } = await res.json();
  return data
    .filter((t) => t.is_streamable !== false)
    .slice(0, 30)
    .map((t) => ({
      source: 'audius',
      sourceId: t.id,
      title: t.title,
      artist: t.user?.name || '',
      duration: t.duration || 0,
      artwork: t.artwork?.['480x480'] || t.artwork?.['1000x1000'] || '',
      url: `https://audius.co${t.permalink || ''}`,
    }));
}

/* ------------------------------ Spotify ----------------------------- */

function parseSpotifyUrl(input) {
  const m = String(input).match(/(playlist|album)[/:]([a-zA-Z0-9]{22})/);
  if (!m) throw new Error('Lien Spotify invalide (playlist ou album attendu)');
  return { kind: m[1], id: m[2] };
}

/** Page "embed" publique : sans clé, mais limitée aux 100 premiers titres. */
async function spotifyEmbed(kind, id) {
  const html = await fetch(`https://open.spotify.com/embed/${kind}/${id}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9' },
  }).then((r) => r.text());
  const nd = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!nd) throw new Error('Playlist introuvable ou privée');
  const entity = JSON.parse(nd[1])?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Playlist introuvable ou privée');
  const images = entity.coverArt?.sources || entity.visualIdentity?.image || [];
  const tracks = (entity.trackList || []).map((t) => ({
    title: t.title,
    artist: t.subtitle?.replace(/ /g, ' ') || '',
    duration: Math.round((t.duration || 0) / 1000),
  }));
  return {
    kind,
    id,
    name: entity.name || entity.title || 'Playlist Spotify',
    owner: entity.subtitle || '',
    cover: images.sort((a, b) => (b.maxWidth || b.width || 0) - (a.maxWidth || a.width || 0))[0]?.url || '',
    tracks,
    via: 'embed',
    limited: tracks.length >= 100,
  };
}

/* API Web officielle (Client Credentials) : pagination complète, nécessite
   SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET (gratuits sur developer.spotify.com). */
function spotifyToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  return cached('sp:token', 50 * 60e3, async () => {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    if (!r.ok) throw new Error('Clés Spotify refusées (vérifie SPOTIFY_CLIENT_ID / SECRET)');
    return (await r.json()).access_token;
  });
}

async function spotifyGet(url) {
  const token = await spotifyToken();
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 429) {
      await new Promise((ok) => setTimeout(ok, (Number(r.headers.get('retry-after')) || 1) * 1000));
      continue;
    }
    if (!r.ok) {
      const err = new Error(`API Spotify ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return r.json();
  }
  throw new Error('API Spotify saturée, réessaie dans un instant');
}

async function spotifyOfficial(kind, id) {
  const API = 'https://api.spotify.com/v1';
  const meta = await spotifyGet(`${API}/${kind}s/${id}?market=FR`);
  const tracks = [];
  const push = (t) => {
    if (!t || t.type === 'episode' || !t.name) return;
    tracks.push({
      title: t.name,
      artist: (t.artists || []).map((a) => a.name).join(', '),
      duration: Math.round((t.duration_ms || 0) / 1000),
    });
  };
  let next;
  if (kind === 'album') next = `${API}/albums/${id}/tracks?limit=50&market=FR`;
  else {
    // L'API a renommé /tracks en /items : on accepte les deux.
    next = `${API}/playlists/${id}/tracks?limit=100&market=FR`;
    try {
      await spotifyGet(`${next}&limit=1`);
    } catch (e) {
      if (e.status === 404 || e.status === 403) next = `${API}/playlists/${id}/items?limit=100&market=FR`;
      else throw e;
    }
  }
  while (next && tracks.length < 10000) {
    const page = await spotifyGet(next);
    for (const it of page.items || []) push(kind === 'album' ? it : it.track || it.item);
    next = page.next;
  }
  return {
    kind,
    id,
    name: meta.name,
    owner: meta.owner?.display_name || (meta.artists || []).map((a) => a.name).join(', '),
    cover: meta.images?.[0]?.url || '',
    tracks,
    via: 'api',
    limited: false,
  };
}

export async function spotifyPlaylist(input) {
  const { kind, id } = parseSpotifyUrl(input);
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    try {
      return await spotifyOfficial(kind, id);
    } catch (e) {
      // Repli : la page embed (100 titres max), avec l'erreur pour le diagnostic.
      const data = await spotifyEmbed(kind, id);
      return { ...data, apiError: e.message };
    }
  }
  return spotifyEmbed(kind, id);
}

/* ------------------------------ Routeur ----------------------------- */

const searchers = { youtube: searchYouTube, soundcloud: searchSoundCloud, audius: searchAudius };

/**
 * @param {string} path ex. "/api/search"
 * @param {URLSearchParams} params
 * @returns {Promise<{status:number, json?:any, redirect?:string}>}
 */
export async function handleApi(path, params) {
  try {
    const route = path.replace(/^\/api/, '').replace(/\/$/, '');
    if (route === '/search') {
      const q = (params.get('q') || '').trim();
      const source = params.get('source') || 'youtube';
      if (!q) return { status: 400, json: { error: 'Paramètre q manquant' } };
      const fn = searchers[source];
      if (!fn) return { status: 400, json: { error: 'Source inconnue' } };
      const results = await cached(`s:${source}:${q.toLowerCase()}`, 30 * 60e3, () => fn(q));
      return { status: 200, json: { results } };
    }
    if (route === '/spotify-status') {
      return { status: 200, json: { api: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) } };
    }
    if (route === '/spotify') {
      const url = params.get('url') || '';
      const data = await cached(`sp:${url}`, 10 * 60e3, () => spotifyPlaylist(url));
      return { status: 200, json: data };
    }
    return { status: 404, json: { error: 'Route inconnue' } };
  } catch (e) {
    return { status: 502, json: { error: e?.message || 'Erreur serveur' } };
  }
}
