import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Playlist, Track } from '../types';
import { uid } from '../lib/format';

interface LibraryState {
  playlists: Playlist[];
  liked: Track[];
  recent: Track[];
  searches: string[];
  likedScreenOff: boolean;
  createPlaylist: (
    name: string,
    opts?: { description?: string; tracks?: Track[]; cover?: string; importedFrom?: string },
  ) => string;
  updatePlaylist: (id: string, patch: Partial<Pick<Playlist, 'name' | 'description' | 'tracks' | 'cover' | 'screenOff'>>) => void;
  /** Option « Écran coupé » d'une playlist (ou des coups de cœur avec 'liked'). */
  setScreenOff: (contextId: string, on: boolean) => void;
  /** Lien de partage reçu du serveur : ne change pas la date de modification. */
  setShareToken: (id: string, token: string | undefined) => void;
  removeTracks: (id: string, trackIds: string[]) => void;
  unlikeMany: (trackIds: string[]) => void;
  deletePlaylist: (id: string) => void;
  addTracks: (id: string, tracks: Track[]) => number;
  removeTrack: (id: string, trackId: string) => void;
  moveTrack: (id: string, from: number, to: number) => void;
  markPlayed: (id: string) => void;
  toggleLike: (t: Track) => boolean;
  pushRecent: (t: Track) => void;
  pushSearch: (q: string) => void;
  clearSearches: () => void;
}

const touch = (p: Playlist, patch: Partial<Playlist>): Playlist => ({ ...p, ...patch, updatedAt: Date.now() });

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      playlists: [],
      liked: [],
      recent: [],
      searches: [],
      likedScreenOff: false,

      createPlaylist: (name, opts = {}) => {
        const id = uid();
        const now = Date.now();
        const playlist: Playlist = {
          id,
          name: name.trim() || `Ma playlist n°${get().playlists.length + 1}`,
          description: opts.description || '',
          tracks: opts.tracks || [],
          cover: opts.cover,
          importedFrom: opts.importedFrom,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ playlists: [playlist, ...s.playlists] }));
        return id;
      },

      updatePlaylist: (id, patch) =>
        set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? touch(p, patch) : p)) })),

      setScreenOff: (contextId, on) =>
        contextId === 'liked' ? set({ likedScreenOff: on }) : get().updatePlaylist(contextId, { screenOff: on }),

      setShareToken: (id, token) =>
        set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, shareToken: token } : p)) })),

      deletePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),

      addTracks: (id, tracks) => {
        const p = get().playlists.find((x) => x.id === id);
        if (!p) return 0;
        const have = new Set(p.tracks.map((t) => t.id));
        const fresh = tracks.filter((t) => !have.has(t.id) && have.add(t.id));
        if (fresh.length) get().updatePlaylist(id, { tracks: [...p.tracks, ...fresh] });
        return fresh.length;
      },

      removeTracks: (id, trackIds) => {
        const drop = new Set(trackIds);
        set((s) => ({
          playlists: s.playlists.map((p) => (p.id === id ? touch(p, { tracks: p.tracks.filter((t) => !drop.has(t.id)) }) : p)),
        }));
      },

      unlikeMany: (trackIds) => {
        const drop = new Set(trackIds);
        set((s) => ({ liked: s.liked.filter((t) => !drop.has(t.id)) }));
      },

      removeTrack: (id, trackId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? touch(p, { tracks: p.tracks.filter((t) => t.id !== trackId) }) : p,
          ),
        })),

      moveTrack: (id, from, to) =>
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== id || to < 0 || to >= p.tracks.length) return p;
            const tracks = [...p.tracks];
            const [t] = tracks.splice(from, 1);
            tracks.splice(to, 0, t);
            return touch(p, { tracks });
          }),
        })),

      markPlayed: (id) =>
        set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, playedAt: Date.now() } : p)) })),

      toggleLike: (t) => {
        const liked = get().liked.some((x) => x.id === t.id);
        set((s) => ({ liked: liked ? s.liked.filter((x) => x.id !== t.id) : [t, ...s.liked] }));
        return !liked;
      },

      pushRecent: (t) => set((s) => ({ recent: [t, ...s.recent.filter((x) => x.id !== t.id)].slice(0, 30) })),

      pushSearch: (q) => {
        const v = q.trim();
        if (v.length < 2) return;
        set((s) => ({ searches: [v, ...s.searches.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 12) }));
      },

      clearSearches: () => set({ searches: [] }),
    }),
    { name: 'wavify-library', version: 1 },
  ),
);
