// Connexion au compte Spotify de l'utilisateur (« Connecter Spotify » sur la page d'import).
// Depuis février 2026, Spotify ne donne les titres d'une playlist qu'à son créateur ou ses collaborateurs.
import { request } from './api';

const KEY = 'wavify-spotify';

interface SpotifySession {
  token: string;
  refresh?: string;
  expires: number; // ms
}

function load(): SpotifySession | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

function save(s: SpotifySession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
}

export const spotifyLoginUrl = '/api/spotify/login';

export const spotifyConnected = () => !!load();

export const disconnectSpotify = () => save(null);

/** Lit le retour de /api/spotify/callback (#spotify_token=…). Renvoie l'erreur éventuelle. */
export function consumeSpotifyRedirect(): string | null {
  if (!location.hash.includes('spotify_')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const token = p.get('spotify_token');
  if (token) {
    save({ token, refresh: p.get('spotify_refresh') || undefined, expires: Date.now() + (Number(p.get('spotify_expires')) || 3600) * 1000 });
    return null;
  }
  return p.get('spotify_error') || 'Connexion à Spotify impossible';
}

/** Jeton d'accès valide (rafraîchi si besoin), ou null si non connecté. */
export async function spotifyToken(): Promise<string | null> {
  const s = load();
  if (!s) return null;
  if (s.expires - Date.now() > 60e3) return s.token;
  if (!s.refresh) {
    save(null);
    return null;
  }
  try {
    const r = await request<{ access_token: string; refresh_token?: string; expires_in: number }>('POST', '/api/spotify/refresh', {
      refresh_token: s.refresh,
    });
    const next = { token: r.access_token, refresh: r.refresh_token || s.refresh, expires: Date.now() + r.expires_in * 1000 };
    save(next);
    return next.token;
  } catch {
    save(null);
    return null;
  }
}
