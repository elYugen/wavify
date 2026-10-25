import type { Source, Track } from '../types';
import { HttpError, searchTracks } from './api';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const PENALTY_WORDS = ['live', 'cover', 'remix', 'karaoke', 'instrumental', 'slowed', 'sped up', 'reverb', 'nightcore', '8d', 'lyrics'];

/** Choisit le résultat le plus proche d'un titre Spotify (titre, artiste, durée). */
export function bestMatch(target: { title: string; artist: string; duration: number }, results: Track[]) {
  const tTitle = norm(target.title.replace(/\(.*?\)|\[.*?\]|- .*$/g, ''));
  const tFull = norm(target.title);
  const artists = norm(target.artist).split(' ').filter((w) => w.length > 2);
  let best: Track | null = null;
  let bestScore = -Infinity;
  results.slice(0, 10).forEach((r, i) => {
    const hay = norm(`${r.title} ${r.artist}`);
    let score = 10 - i;
    if (tTitle && hay.includes(tTitle)) score += 20;
    score += artists.filter((a) => hay.includes(a)).length * 4;
    if (/official audio|topic|audio officiel/.test(norm(r.title + ' ' + r.artist)) || r.artist === target.artist) score += 6;
    for (const w of PENALTY_WORDS) if (hay.includes(w) && !tFull.includes(w)) score -= 12;
    if (target.duration && r.duration) {
      const diff = Math.abs(target.duration - r.duration);
      score += diff < 5 ? 12 : diff < 15 ? 6 : diff < 40 ? 0 : -15;
    }
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  });
  return bestScore > 5 ? best : null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cherche un titre. Renvoie null s'il est introuvable.
 * Lève une HttpError si le serveur reste injoignable ou en erreur après plusieurs essais.
 */
export async function matchTrack(source: Source, target: { title: string; artist: string; duration: number }) {
  const primary = target.artist.split(',')[0];
  for (let attempt = 0; ; attempt++) {
    try {
      const results = await searchTracks(source, `${primary} ${target.title}`.trim());
      return bestMatch(target, results);
    } catch (e) {
      const retryable = e instanceof HttpError && (e.status === 0 || e.status === 429 || e.status >= 500);
      if (!retryable || attempt >= 2) throw e;
      await wait(700 * 2 ** attempt); // 0,7 s puis 1,4 s
    }
  }
}

/** Exécute des tâches avec une concurrence limitée. */
export async function pool<T>(items: T[], limit: number, worker: (item: T, i: number) => Promise<void>, signal?: AbortSignal) {
  let next = 0;
  const run = async () => {
    while (next < items.length && !signal?.aborted) {
      const i = next++;
      await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}
