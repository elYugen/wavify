import type { Source, SpotifyImport, Track } from '../types';

type RawTrack = Omit<Track, 'id'>;

export const withId = (t: RawTrack): Track => ({ ...t, id: `${t.source}:${t.sourceId}` });

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* corps vide */
  }
  if (!res.ok) throw new Error(body?.error || `Erreur ${res.status}`);
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
