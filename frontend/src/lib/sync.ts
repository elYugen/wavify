// Synchronisation de la bibliothèque avec le compte (backend Laravel).
// Le localStorage reste la copie de travail : chaque modification est notée comme « en attente »,
// envoyée au serveur dès que possible, et la version du serveur est rechargée au retour sur l'app.
import { create } from 'zustand';
import { HttpError, request } from './api';
import { useAuth } from '../store/auth';
import { useLibrary } from '../store/library';
import type { Playlist, Track } from '../types';

type Meta = 'liked' | 'recent' | 'searches' | 'likedScreenOff';

interface RemoteLibrary {
  playlists: Playlist[];
  liked: Track[];
  recent: Track[];
  searches: string[];
  likedScreenOff: boolean;
}

interface SyncState {
  status: 'idle' | 'syncing' | 'offline';
  lastSync: number | null;
}

export const useSync = create<SyncState>(() => ({ status: 'idle', lastSync: null }));

/* --------------------------- File d'attente --------------------------- */

const KEY = 'wavify-sync-pending';

function loadPending() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { upsert: new Set<string>(p.upsert), remove: new Set<string>(p.remove), meta: new Set<Meta>(p.meta) };
  } catch {
    return { upsert: new Set<string>(), remove: new Set<string>(), meta: new Set<Meta>() };
  }
}

const pending = loadPending();

function savePending() {
  localStorage.setItem(KEY, JSON.stringify({ upsert: [...pending.upsert], remove: [...pending.remove], meta: [...pending.meta] }));
}

function clearPending() {
  pending.upsert.clear();
  pending.remove.clear();
  pending.meta.clear();
  savePending();
}

export const hasPending = () => pending.upsert.size + pending.remove.size + pending.meta.size > 0;

const first = <T>(s: Set<T>) => s.values().next().value as T;

/* ------------------------- Écriture dans le store ------------------------- */

// Vrai pendant qu'on applique des données du serveur : ces changements ne repartent pas au serveur.
let applying = false;
function apply(patch: Partial<RemoteLibrary>) {
  applying = true;
  try {
    useLibrary.setState(patch);
  } finally {
    applying = false;
  }
}

function applyPlaylist(id: string, p: Playlist | null) {
  const list = useLibrary.getState().playlists;
  apply({ playlists: p ? list.map((x) => (x.id === id ? p : x)) : list.filter((x) => x.id !== id) });
}

function watchLibrary() {
  useLibrary.subscribe((s, prev) => {
    if (applying || !useAuth.getState().token) return;
    if (s.playlists !== prev.playlists) {
      const before = new Map(prev.playlists.map((p) => [p.id, p]));
      for (const p of s.playlists) {
        if (before.get(p.id) !== p) pending.upsert.add(p.id);
        before.delete(p.id);
      }
      for (const id of before.keys()) {
        pending.upsert.delete(id);
        pending.remove.add(id);
      }
    }
    if (s.liked !== prev.liked) pending.meta.add('liked');
    if (s.recent !== prev.recent) pending.meta.add('recent');
    if (s.searches !== prev.searches) pending.meta.add('searches');
    if (s.likedScreenOff !== prev.likedScreenOff) pending.meta.add('likedScreenOff');
    savePending();
    schedule();
  });
}

/* ------------------------------- Envoi ------------------------------- */

let timer: ReturnType<typeof setTimeout> | undefined;
function schedule(ms = 1500) {
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), ms);
}

/** Erreur définitive pour cet élément (données refusées) : on l'abandonne au lieu de bloquer la file. */
const rejected = (e: unknown) => e instanceof HttpError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status);

async function sendAll() {
  while (pending.remove.size) {
    const id = first(pending.remove);
    try {
      await request('DELETE', `/api/playlists/${encodeURIComponent(id)}`);
    } catch (e) {
      if (!rejected(e)) throw e;
    }
    pending.remove.delete(id);
    savePending();
  }

  while (pending.upsert.size) {
    const id = first(pending.upsert);
    const p = useLibrary.getState().playlists.find((x) => x.id === id);
    if (p) {
      try {
        const r = await request<{ playlist: Playlist | null; stale: boolean }>('PUT', `/api/playlists/${encodeURIComponent(id)}`, p);
        // Le serveur a une version plus récente (ou la playlist a été supprimée ailleurs) : on la reprend.
        if (r.stale) applyPlaylist(id, r.playlist);
        // Modifiée pendant l'envoi : elle reste dans la file pour repartir.
        else if (useLibrary.getState().playlists.find((x) => x.id === id) !== p) continue;
        // Rendue publique : le serveur a créé le lien de partage.
        else if (r.playlist?.shareToken !== p.shareToken) applyPlaylist(id, { ...p, shareToken: r.playlist?.shareToken });
      } catch (e) {
        if (!rejected(e)) throw e;
        console.warn(`Playlist ${id} refusée par le serveur`, e);
      }
    }
    pending.upsert.delete(id);
    savePending();
  }

  if (pending.meta.size) {
    const s = useLibrary.getState();
    const sent = { liked: s.liked, recent: s.recent, searches: s.searches, likedScreenOff: s.likedScreenOff };
    const body: Partial<typeof sent> = {};
    for (const m of pending.meta) (body as any)[m] = sent[m];
    try {
      await request('PUT', '/api/library', body);
    } catch (e) {
      if (!rejected(e)) throw e;
    }
    const now = useLibrary.getState();
    for (const m of Object.keys(body) as Meta[]) if (now[m] === sent[m]) pending.meta.delete(m);
    savePending();
  }
}

let running: Promise<boolean> | null = null;

/** Envoie les modifications en attente. Renvoie false si le serveur n'a pas pu être joint. */
export function flush(): Promise<boolean> {
  if (!useAuth.getState().token) return Promise.resolve(true);
  if (running) return running.then(() => (hasPending() ? flush() : true));
  clearTimeout(timer);
  useSync.setState({ status: 'syncing' });
  running = sendAll()
    .then(() => {
      useSync.setState({ status: 'idle', lastSync: Date.now() });
      return true;
    })
    .catch((e) => {
      if (e instanceof HttpError && e.status === 401) {
        // Jeton révoqué ou expiré : on repasse en local.
        useAuth.getState().clear();
        clearPending();
        useSync.setState({ status: 'idle' });
        return true;
      }
      useSync.setState({ status: 'offline' });
      schedule(30000);
      return false;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/* ------------------------------ Réception ------------------------------ */

/** Garde les objets locaux identiques à ceux du serveur (évite des rendus et des envois inutiles). */
function reuse(remote: Playlist[], local: Playlist[]) {
  const byId = new Map(local.map((p) => [p.id, p]));
  return remote.map((r) => {
    const l = byId.get(r.id);
    return l && l.updatedAt === r.updatedAt && l.playedAt === r.playedAt && l.tracks.length === r.tracks.length ? l : r;
  });
}

let lastPull = 0;

/** Recharge la bibliothèque du compte (après avoir envoyé ce qui est en attente). */
export async function pull() {
  if (!useAuth.getState().token || !(await flush())) return;
  lastPull = Date.now();
  let remote: RemoteLibrary;
  try {
    remote = await request<RemoteLibrary>('GET', '/api/library');
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      useAuth.getState().clear();
      clearPending();
    } else useSync.setState({ status: 'offline' });
    return;
  }
  // Modifié pendant le chargement : la version locale gagne, elle repartira au prochain envoi.
  if (hasPending() || !useAuth.getState().token) return;
  apply({ ...remote, playlists: reuse(remote.playlists, useLibrary.getState().playlists) });
  useSync.setState({ status: 'idle', lastSync: Date.now() });
}

const union = (a: Track[], b: Track[]) => {
  const seen = new Set(a.map((t) => t.id));
  return [...a, ...b.filter((t) => !seen.has(t.id) && seen.add(t.id))];
};

/** Juste après la connexion : fusionne la bibliothèque de cet appareil avec celle du compte. */
export async function mergeAfterLogin() {
  const remote = await request<RemoteLibrary>('GET', '/api/library');
  const local = useLibrary.getState();

  const playlists = [...remote.playlists];
  const index = new Map(playlists.map((p, i) => [p.id, i]));
  for (const p of local.playlists) {
    const i = index.get(p.id);
    if (i === undefined) playlists.push(p);
    else if (p.updatedAt > playlists[i].updatedAt) playlists[i] = p;
    else continue;
    pending.upsert.add(p.id);
  }

  const liked = union(remote.liked, local.liked);
  if (liked.length !== remote.liked.length) pending.meta.add('liked');
  const recent = remote.recent.length ? remote.recent : local.recent;
  if (recent !== remote.recent) pending.meta.add('recent');
  const searches = [...new Set([...remote.searches, ...local.searches])].slice(0, 12);
  if (searches.length !== remote.searches.length) pending.meta.add('searches');

  const likedScreenOff = remote.likedScreenOff || local.likedScreenOff;
  if (likedScreenOff !== remote.likedScreenOff) pending.meta.add('likedScreenOff');

  savePending();
  apply({ playlists, liked, recent, searches, likedScreenOff });
  await flush();
}

/**
 * Déconnexion : envoie d'abord ce qui reste, puis vide la bibliothèque de cet appareil.
 * Renvoie false (sans déconnecter) si des modifications n'ont pas pu partir, sauf avec force.
 */
export async function signOut(force = false) {
  if (!(await flush()) && !force) return false;
  await useAuth.getState().logout();
  clearPending();
  apply({ playlists: [], liked: [], recent: [], searches: [], likedScreenOff: false });
  return true;
}

/** À appeler une fois au démarrage. */
export function initSync() {
  watchLibrary();
  window.addEventListener('online', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastPull > 60e3) void pull();
  });
  void pull();
}
