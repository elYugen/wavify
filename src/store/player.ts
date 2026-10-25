import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track } from '../types';
import { engine } from '../player/engine';
import { useLibrary } from './library';
import { toast } from './toast';

type Repeat = 'off' | 'all' | 'one';

interface PlayerState {
  queue: Track[];
  unshuffled: Track[] | null;
  index: number;
  contextId: string | null; // playlist d'origine
  isPlaying: boolean;
  loading: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: Repeat;
  nowPlayingOpen: boolean;

  current: () => Track | null;
  playQueue: (tracks: Track[], start?: number, contextId?: string | null) => void;
  playAt: (index: number) => void;
  toggle: () => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (t: Track) => void;
  playNext: (t: Track) => void;
  removeFromQueue: (i: number) => void;
  setNowPlaying: (open: boolean) => void;
}

function shuffled<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => {
      const start = (t: Track) => {
        set({ position: 0, duration: t.duration, isPlaying: true });
        engine.load(t, true);
        useLibrary.getState().pushRecent(t);
      };

      return {
        queue: [],
        unshuffled: null,
        index: 0,
        contextId: null,
        isPlaying: false,
        loading: false,
        position: 0,
        duration: 0,
        volume: 1,
        shuffle: false,
        repeat: 'off',
        nowPlayingOpen: false,

        current: () => get().queue[get().index] ?? null,

        playQueue: (tracks, startAt = 0, contextId = null) => {
          if (!tracks.length) return;
          let queue = tracks;
          let index = startAt;
          let unshuffled: Track[] | null = null;
          if (get().shuffle) {
            unshuffled = tracks;
            const first = tracks[startAt];
            queue = [first, ...shuffled(tracks.filter((_, i) => i !== startAt))];
            index = 0;
          }
          set({ queue, index, unshuffled, contextId });
          if (contextId) useLibrary.getState().markPlayed(contextId);
          start(queue[index]);
        },

        playAt: (index) => {
          const t = get().queue[index];
          if (!t) return;
          set({ index });
          start(t);
        },

        toggle: () => {
          const t = get().current();
          if (!t) return;
          if (engine.current?.id !== t.id) return start(t);
          if (get().isPlaying) {
            engine.pause();
            set({ isPlaying: false });
          } else {
            engine.play();
            set({ isPlaying: true });
          }
        },

        next: (auto = false) => {
          const { queue, index, repeat } = get();
          if (auto && repeat === 'one') {
            engine.seek(0);
            engine.play();
            return;
          }
          if (index + 1 < queue.length) return get().playAt(index + 1);
          if (repeat === 'all' && queue.length) return get().playAt(0);
          if (auto) {
            set({ isPlaying: false, position: 0 });
            engine.pause();
          }
        },

        prev: () => {
          const { position, index } = get();
          if (position > 3 || index === 0) {
            engine.seek(0);
            set({ position: 0 });
          } else get().playAt(index - 1);
        },

        seek: (sec) => {
          engine.seek(sec);
          set({ position: sec });
        },

        setVolume: (v) => {
          engine.setVolume(v);
          set({ volume: v });
        },

        toggleShuffle: () => {
          const { shuffle, queue, index, unshuffled } = get();
          const cur = queue[index];
          if (!shuffle) {
            const rest = shuffled(queue.filter((_, i) => i !== index));
            set({ shuffle: true, unshuffled: queue, queue: cur ? [cur, ...rest] : rest, index: 0 });
          } else {
            const base = unshuffled || queue;
            set({ shuffle: false, unshuffled: null, queue: base, index: Math.max(0, base.findIndex((t) => t.id === cur?.id)) });
          }
        },

        cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),

        addToQueue: (t) => {
          const empty = !get().queue.length;
          set((s) => ({ queue: [...s.queue, t], unshuffled: s.unshuffled ? [...s.unshuffled, t] : null }));
          if (empty) start(t);
          toast("Ajouté à la file d'attente");
        },

        playNext: (t) => {
          const empty = !get().queue.length;
          set((s) => {
            const q = [...s.queue];
            q.splice(s.index + 1, 0, t);
            return { queue: q };
          });
          if (empty) start(t);
          toast('Sera lu juste après');
        },

        removeFromQueue: (i) =>
          set((s) => {
            if (i === s.index) return s;
            const q = s.queue.filter((_, k) => k !== i);
            return { queue: q, index: i < s.index ? s.index - 1 : s.index };
          }),

        setNowPlaying: (open) => set({ nowPlayingOpen: open }),
      };
    },
    {
      name: 'wavify-player',
      partialize: (s) => ({ queue: s.queue, index: s.index, volume: s.volume, shuffle: s.shuffle, repeat: s.repeat, unshuffled: s.unshuffled, contextId: s.contextId }),
    },
  ),
);

/** Branche le moteur sur le store + Media Session (contrôles écran verrouillé / casque). */
export function initPlayer() {
  const P = () => usePlayer.getState();
  let lastError = 0;
  engine.init({
    onTime: (position, duration) => usePlayer.setState({ position, duration: duration || P().duration }),
    onPlay: () => usePlayer.setState({ isPlaying: true, loading: false }),
    onPause: () => usePlayer.setState({ isPlaying: false }),
    onEnded: () => P().next(true),
    onLoading: (loading) => usePlayer.setState({ loading }),
    onError: (msg) => {
      toast(`${msg} — titre suivant`);
      usePlayer.setState({ loading: false });
      // évite une boucle infinie si toute la file échoue
      if (Date.now() - lastError > 1500 && P().index + 1 < P().queue.length) setTimeout(() => P().next(), 1200);
      else usePlayer.setState({ isPlaying: false });
      lastError = Date.now();
    },
  });
  engine.setVolume(P().volume);

  const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
  if (ms) {
    const set = (a: MediaSessionAction, fn: MediaSessionActionHandler) => {
      try {
        ms.setActionHandler(a, fn);
      } catch {
        /* action non supportée */
      }
    };
    set('play', () => P().toggle());
    set('pause', () => P().toggle());
    set('nexttrack', () => P().next());
    set('previoustrack', () => P().prev());
    set('seekto', (d) => d.seekTime != null && P().seek(d.seekTime));
  }

  let lastId: string | null = null;
  usePlayer.subscribe((s) => {
    const t = s.queue[s.index];
    if (ms) ms.playbackState = s.isPlaying ? 'playing' : 'paused';
    if (!t || t.id === lastId) return;
    lastId = t.id;
    document.title = `${t.title} · ${t.artist}`;
    if (ms && 'MediaMetadata' in window) {
      ms.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: 'Wavify',
        artwork: t.artwork ? [{ src: t.artwork, sizes: '512x512' }] : [],
      });
    }
  });
}
