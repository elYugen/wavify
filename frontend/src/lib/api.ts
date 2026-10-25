import type { SharedPlaylist, Source, SpotifyImport, Track } from '../types';

type RawTrack = Omit<Track, 'id'>;

export const withId = (t: RawTrack): Track => ({ ...t, id: `${t.source}:${t.sourceId}` });

/** Erreur HTTP avec son code ; status 0 = serveur injoignable. */
export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Jeton Sanctum du compte connecté (fixé par le store auth).
let authToken: string | null = null;
export const setAuthToken = (t: string | null) => {
  authToken = t;
};

/** Requête JSON vers le backend Laravel. Le corps d'erreur Laravel ({message, errors}) donne le message. */
export async function request<T>(method: string, url: string, data?: unknown, signal?: AbortSignal, extra?: Record<string, string>): Promise<T> {
  // Délai max : une requête bloquée (serveur coupé en pleine réponse) finit par échouer.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  const forward = () => ctrl.abort();
  signal?.addEventListener('abort', forward);
  const headers: Record<string, string> = { Accept: 'application/json', ...extra };
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: data === undefined ? undefined : JSON.stringify(data), signal: ctrl.signal });
  } catch (e: any) {
    if (signal?.aborted) throw e;
    throw new HttpError('Serveur injoignable', 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* corps vide */
  }
  if (!res.ok) {
    const first = body?.errors && (Object.values(body.errors)[0] as string[] | undefined)?.[0];
    throw new HttpError(first || body?.error || body?.message || `Erreur ${res.status}`, res.status);
  }
  return body as T;
}

const getJson = <T>(url: string, signal?: AbortSignal) => request<T>('GET', url, undefined, signal);

export async function searchTracks(source: Source, q: string, signal?: AbortSignal) {
  const { results } = await getJson<{ results: RawTrack[] }>(
    `/api/search?source=${source}&q=${encodeURIComponent(q)}`,
    signal,
  );
  return results.map(withId);
}

/** @param spotifyToken jeton du compte Spotify connecté : donne accès à toutes ses playlists, sans limite. */
export function fetchSpotify(url: string, spotifyToken?: string | null) {
  return request<SpotifyImport>('GET', `/api/spotify?url=${encodeURIComponent(url)}`, undefined, undefined, spotifyToken ? { 'X-Spotify-Token': spotifyToken } : undefined);
}

export function audiusStreamUrl(id: string) {
  return `https://api.audius.co/v1/tracks/${encodeURIComponent(id)}/stream?app_name=wavify-pwa`;
}

export const fetchShared = (token: string) => getJson<SharedPlaylist>(`/api/shared/${encodeURIComponent(token)}`);

/** Crée (ou renvoie) le lien de partage d'une playlist du compte. */
export const sharePlaylist = (id: string) => request<{ token: string }>('POST', `/api/playlists/${encodeURIComponent(id)}/share`);

export const unsharePlaylist = (id: string) => request('DELETE', `/api/playlists/${encodeURIComponent(id)}/share`);

/** Flux audio YouTube relayé par le serveur (yt-dlp) : se lit écran verrouillé, contrairement à l'iframe. */
export const youtubeAudioUrl = (id: string) => `/api/stream/youtube/${encodeURIComponent(id)}`;

export async function youtubeAudioEnabled() {
  try {
    return (await getJson<{ youtube: boolean }>('/api/stream/status')).youtube;
  } catch {
    return false;
  }
}

export async function spotifyApiEnabled() {
  try {
    return (await getJson<{ api: boolean }>('/api/spotify-status')).api;
  } catch {
    return false;
  }
}
