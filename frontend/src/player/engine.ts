// Moteur de lecture unifié.
//  - Audius      : <audio> HTML5 (fonctionne écran verrouillé)
//  - YouTube     : IFrame Player API officielle (démarrage immédiat, coupée écran verrouillé),
//                  ou <audio> sur le flux relayé par le serveur (yt-dlp) pour les playlists « Écran coupé »
//  - SoundCloud  : Widget API officielle
import type { Track } from '../types';
import { audiusStreamUrl, youtubeAudioUrl } from '../lib/api';

export interface EngineHandlers {
  onTime: (position: number, duration: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onLoading: (loading: boolean) => void;
  onError: (message: string) => void;
}

declare global {
  interface Window {
    YT: any;
    SC: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    document.head.appendChild(s);
  });
}

const YT_ERRORS: Record<number, string> = {
  2: 'Vidéo YouTube invalide',
  5: 'Erreur du lecteur YouTube',
  100: 'Vidéo supprimée ou privée',
  101: "L'auteur interdit la lecture hors YouTube",
  150: "L'auteur interdit la lecture hors YouTube",
};

type Mode = 'audio' | 'youtube' | 'soundcloud';

class Engine {
  private h!: EngineHandlers;
  private audio!: HTMLAudioElement;
  private mode: Mode | null = null; // lecteur actif
  current: Track | null = null;
  private volume = 1;

  // Lecture YouTube en audio via le serveur (si yt-dlp y est installé) ; les vidéos dont le flux a échoué
  // repassent par l'iframe.
  private ytAudio = false;
  private ytAudioFailed = new Set<string>();

  private ytHost!: HTMLDivElement;
  private ytReady: Promise<any> | null = null;
  private ytTimer: ReturnType<typeof setInterval> | undefined;
  private anchor: HTMLElement | null = null;
  private raf = 0;

  private scFrame: HTMLIFrameElement | null = null;
  private scReady: Promise<any> | null = null;
  private scDuration = 0;

  init(handlers: EngineHandlers) {
    if (this.audio) return;
    this.h = handlers;
    const a = (this.audio = new Audio());
    a.preload = 'auto';
    const mine = () => this.mode === 'audio';
    a.addEventListener('timeupdate', () => mine() && this.h.onTime(a.currentTime, a.duration || this.current?.duration || 0));
    a.addEventListener('play', () => mine() && this.h.onPlay());
    a.addEventListener('pause', () => mine() && this.h.onPause());
    a.addEventListener('ended', () => mine() && this.h.onEnded());
    a.addEventListener('waiting', () => mine() && this.h.onLoading(true));
    a.addEventListener('playing', () => mine() && this.h.onLoading(false));
    a.addEventListener('error', () => {
      const t = this.current;
      if (!mine() || !a.src || !t) return;
      if (t.source === 'youtube') {
        // Flux serveur indisponible (yt-dlp bloqué…) : on retombe sur le lecteur YouTube intégré.
        this.ytAudioFailed.add(t.sourceId);
        this.loadYouTubeIframe(t, true);
      } else this.h.onError('Flux Audius indisponible');
    });

    // Conteneur du lecteur YouTube : caché par défaut, superposé à la pochette en plein écran.
    const host = (this.ytHost = document.createElement('div'));
    host.id = 'yt-host';
    Object.assign(host.style, {
      position: 'fixed', left: '0px', bottom: '0px', width: '200px', height: '200px',
      opacity: '0', pointerEvents: 'none', zIndex: '-1', overflow: 'hidden', borderRadius: '24px',
      transition: 'opacity .25s',
    });
    document.body.appendChild(host);
  }

  /* --------------------------- YouTube --------------------------- */

  private ensureYT() {
    if (!this.ytReady) {
      this.ytReady = new Promise((resolve, reject) => {
        const make = () => {
          const el = document.createElement('div');
          this.ytHost.appendChild(el);
          const player = new window.YT.Player(el, {
            width: '100%',
            height: '100%',
            playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0, iv_load_policy: 3, fs: 0, modestbranding: 1, cc_load_policy: 0 },
            events: {
              onReady: () => resolve(player),
              onStateChange: (e: { data: number }) => this.onYtState(e.data),
              onError: (e: { data: number }) =>
                this.mode === 'youtube' && this.h.onError(YT_ERRORS[e.data] || 'Lecture YouTube impossible'),
            },
          });
        };
        if (window.YT?.Player) make();
        else {
          window.onYouTubeIframeAPIReady = make;
          loadScript('https://www.youtube.com/iframe_api').catch(reject);
        }
      });
    }
    return this.ytReady;
  }

  private onYtState(state: number) {
    if (this.mode !== 'youtube') return;
    const YT = window.YT.PlayerState;
    clearInterval(this.ytTimer);
    if (state === YT.PLAYING) {
      this.ytReady?.then((p) => p.unloadModule?.('captions'));
      this.h.onLoading(false);
      this.h.onPlay();
      this.ytTimer = setInterval(async () => {
        const p = await this.ytReady;
        this.h.onTime(p.getCurrentTime(), p.getDuration() || this.current?.duration || 0);
      }, 250);
    } else if (state === YT.PAUSED) this.h.onPause();
    else if (state === YT.BUFFERING) this.h.onLoading(true);
    else if (state === YT.ENDED) this.h.onEnded();
  }

  /** Superpose le lecteur YouTube visible sur un élément (vue plein écran). */
  setVideoAnchor(el: HTMLElement | null) {
    this.anchor = el;
    cancelAnimationFrame(this.raf);
    const s = this.ytHost.style;
    if (!el) {
      Object.assign(s, { opacity: '0', pointerEvents: 'none', zIndex: '-1', left: '0px', top: '', bottom: '0px', width: '200px', height: '200px' });
      return;
    }
    const sync = () => {
      if (!this.anchor) return;
      const r = this.anchor.getBoundingClientRect();
      const visible = this.mode === 'youtube';
      Object.assign(s, {
        left: `${r.left}px`, top: `${r.top}px`, bottom: '', width: `${r.width}px`, height: `${r.height}px`,
        opacity: visible ? '1' : '0', pointerEvents: visible ? 'auto' : 'none', zIndex: visible ? '70' : '-1',
      });
      this.raf = requestAnimationFrame(sync);
    };
    sync();
  }

  /* -------------------------- SoundCloud -------------------------- */

  private ensureSC(firstUrl: string) {
    if (!this.scReady) {
      this.scReady = (async () => {
        await loadScript('https://w.soundcloud.com/player/api.js');
        const f = (this.scFrame = document.createElement('iframe'));
        f.allow = 'autoplay; encrypted-media';
        f.title = 'SoundCloud';
        Object.assign(f.style, { position: 'fixed', width: '1px', height: '1px', left: '-10px', bottom: '0', opacity: '0', border: '0' });
        f.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(firstUrl)}&auto_play=true&visual=false&show_artwork=false`;
        document.body.appendChild(f);
        const w = window.SC.Widget(f);
        const E = window.SC.Widget.Events;
        await new Promise<void>((r) => w.bind(E.READY, () => r()));
        const mine = () => this.mode === 'soundcloud';
        w.bind(E.PLAY, () => {
          if (!mine()) return;
          this.h.onLoading(false);
          this.h.onPlay();
          w.getDuration((d: number) => (this.scDuration = d / 1000));
        });
        w.bind(E.PAUSE, () => mine() && this.h.onPause());
        w.bind(E.FINISH, () => mine() && this.h.onEnded());
        w.bind(E.ERROR, () => mine() && this.h.onError('Lecture SoundCloud impossible'));
        w.bind(E.PLAY_PROGRESS, (e: { currentPosition: number }) => {
          if (mine()) this.h.onTime(e.currentPosition / 1000, this.scDuration || this.current?.duration || 0);
        });
        return w;
      })();
      this.scReady.catch(() => (this.scReady = null));
      return { widget: this.scReady, fresh: true };
    }
    return { widget: this.scReady, fresh: false };
  }

  /* ----------------------------- API ----------------------------- */

  /** Active la lecture YouTube en audio (le serveur a yt-dlp). */
  setYouTubeAudio(on: boolean) {
    this.ytAudio = on;
  }

  /** Fait résoudre le flux d'un titre YouTube par le serveur à l'avance (2 octets demandés). */
  warm(track: Track) {
    if (track.source !== 'youtube' || !this.ytAudio || this.ytAudioFailed.has(track.sourceId)) return;
    fetch(youtubeAudioUrl(track.sourceId), { headers: { Range: 'bytes=0-1' } }).catch(() => {});
  }

  private stopOthers(next: Mode) {
    if (next !== 'audio' && !this.audio.paused) this.audio.pause();
    if (next !== 'youtube' && this.ytReady) this.ytReady.then((p) => p.pauseVideo?.()).catch(() => {});
    if (next !== 'soundcloud' && this.scReady) this.scReady.then((w) => w.pause()).catch(() => {});
    clearInterval(this.ytTimer);
  }

  private setMode(mode: Mode) {
    this.stopOthers(mode);
    this.mode = mode;
    // Le lecteur vidéo superposé (plein écran) n'apparaît qu'en mode iframe.
    if (this.anchor) this.setVideoAnchor(this.anchor);
  }

  private async loadYouTubeIframe(track: Track, autoplay: boolean) {
    this.setMode('youtube');
    this.audio.removeAttribute('src');
    try {
      const p = await this.ensureYT();
      if (this.current !== track) return;
      p.setVolume(this.volume * 100);
      if (autoplay) p.loadVideoById(track.sourceId);
      else {
        p.cueVideoById(track.sourceId);
        this.h.onLoading(false);
      }
    } catch (e: any) {
      this.h.onLoading(false);
      this.h.onError(e?.message || 'Lecture YouTube impossible');
    }
  }

  /** @param screenOff lire YouTube en audio via le serveur (option « Écran coupé » de la playlist). */
  async load(track: Track, autoplay = true, screenOff = false) {
    this.current = track;
    this.h.onTime(0, track.duration);
    this.h.onLoading(true);
    const viaAudio =
      track.source === 'audius' || (track.source === 'youtube' && screenOff && this.ytAudio && !this.ytAudioFailed.has(track.sourceId));
    if (viaAudio) {
      this.setMode('audio');
      // play() est appelé tout de suite, dans le geste de l'utilisateur : obligatoire sur iPhone.
      this.audio.src = track.source === 'audius' ? audiusStreamUrl(track.sourceId) : youtubeAudioUrl(track.sourceId);
      this.audio.volume = this.volume;
      if (!autoplay) return this.h.onLoading(false);
      try {
        await this.audio.play();
      } catch (e: any) {
        // Échec du flux : géré par l'événement « error » (repli iframe pour YouTube).
        if (e?.name === 'NotAllowedError' && this.current === track) {
          this.h.onLoading(false);
          this.h.onPause();
        }
      }
      return;
    }
    if (track.source === 'youtube') return this.loadYouTubeIframe(track, autoplay);

    this.setMode('soundcloud');
    try {
      const url = `https://api.soundcloud.com/tracks/${track.sourceId}`;
      this.scDuration = track.duration;
      const { widget, fresh } = this.ensureSC(url);
      const w = await widget;
      if (this.current !== track) return;
      w.setVolume(this.volume * 100);
      if (!fresh) {
        await new Promise<void>((r) => w.load(url, { auto_play: autoplay, visual: false, show_artwork: false, callback: () => r() }));
        if (this.current === track) w.setVolume(this.volume * 100);
      }
      // Sur mobile, auto_play dans l'URL du widget est bloqué : on relance explicitement.
      if (autoplay) w.play();
      else this.h.onLoading(false);
    } catch (e: any) {
      this.h.onLoading(false);
      if (e?.name === 'NotAllowedError') this.h.onPause();
      else this.h.onError(e?.message || 'Lecture impossible');
    }
  }

  play() {
    if (this.mode === 'audio') this.audio.play().catch(() => this.h.onPause());
    else if (this.mode === 'youtube') this.ytReady?.then((p) => p.playVideo());
    else if (this.mode === 'soundcloud') this.scReady?.then((w) => w.play());
  }

  pause() {
    if (this.mode === 'audio') this.audio.pause();
    else if (this.mode === 'youtube') this.ytReady?.then((p) => p.pauseVideo());
    else if (this.mode === 'soundcloud') this.scReady?.then((w) => w.pause());
  }

  seek(sec: number) {
    if (this.mode === 'audio') this.audio.currentTime = sec;
    else if (this.mode === 'youtube') this.ytReady?.then((p) => p.seekTo(sec, true));
    else if (this.mode === 'soundcloud') this.scReady?.then((w) => w.seekTo(sec * 1000));
  }

  setVolume(v: number) {
    this.volume = v;
    this.audio.volume = v;
    this.ytReady?.then((p) => p.setVolume(v * 100));
    this.scReady?.then((w) => w.setVolume(v * 100));
  }
}

export const engine = new Engine();
