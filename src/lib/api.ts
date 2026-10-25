import type { Source, SpotifyImport, Track } from '../types';

type RawTrack = Omit<Track, 'id'>;

export const withId = (t: RawTrack): Track => ({ ...t, id: `${t.source}:${t.sourceId}` });

/** Erreur HTTP avec son code ; status 0 = serveur injoignable. */
export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  // Délai max : une requête bloquée (serveur coupé en pleine réponse) finit par échouer.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  const forward = () => ctrl.abort();
  signal?.addEventListener('abort', forward);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
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
  if (!res.ok) throw new HttpError(body?.error || `Erreur ${res.status}`, res.status);
  return body as T;
}

export async function searchTracks(source: Source, q: string, signal?: AbortSignal) {
  const { results } = await getJson<{ results: RawTrack[] }>(
    `/api/search?source=${source}&q=${encodeURIComponent(q)}`,
    signal,
  );
  return results.map(withId);
}

export function fetchSpotify(url: string) {
  return getJson<SpotifyImport>(`/api/spotify?url=${encodeURIComponent(url)}`);
}

export function audiusStreamUrl(id: string) {
  return `https://api.audius.co/v1/tracks/${encodeURIComponent(id)}/stream?app_name=wavify-pwa`;
}

export async function spotifyApiEnabled() {
  try {
    return (await getJson<{ api: boolean }>('/api/spotify-status')).api;
  } catch {
    return false;
  }
}
