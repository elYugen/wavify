import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown, Heart, ListMusic, LoaderCircle, MoreVertical, Pause, Play, Repeat, Repeat1,
  Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X,
} from 'lucide-react';
import { usePlayer } from '../store/player';
import { useLibrary } from '../store/library';
import { useUi } from '../store/ui';
import { toast } from '../store/toast';
import { engine } from '../player/engine';
import { fmtTime } from '../lib/format';
import { SOURCES } from '../lib/sources';
import { Artwork } from './Artwork';
import { Slider } from './Slider';
import { SourceIcon } from './SourceIcon';
import { Equalizer } from './Equalizer';
import { Vinyl } from './Vinyl';

function useCurrent() {
  return usePlayer((s) => s.queue[s.index] ?? null);
}

function PlayButton({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { isPlaying, loading, toggle } = usePlayer();
  const cls = size === 'lg' ? 'size-[72px]' : 'size-10';
  const icon = size === 'lg' ? 'size-8' : 'size-[18px]';
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      className={`bg-sunset grid shrink-0 place-items-center rounded-full text-on-accent shadow-[0_10px_30px_-6px_rgba(255,106,61,.65)] transition hover:brightness-110 active:scale-90 ${cls}`}
      aria-label={isPlaying ? 'Pause' : 'Lecture'}
    >
      {loading && isPlaying ? (
        <LoaderCircle className={`${icon} animate-spin`} />
      ) : isPlaying ? (
        <Pause className={`${icon} fill-current`} />
      ) : (
        <Play className={`${icon} translate-x-[1px] fill-current`} />
      )}
    </button>
  );
}

/** Bouton lecture entouré d'un anneau de progression (mini-lecteur). */
function RingPlay() {
  const { isPlaying, loading, toggle, position, duration } = usePlayer();
  const r = 19;
  const c = 2 * Math.PI * r;
  const p = duration ? Math.min(1, position / duration) : 0;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      className="relative grid size-11 shrink-0 place-items-center active:scale-90"
      aria-label={isPlaying ? 'Pause' : 'Lecture'}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" x2="1">
            <stop offset="0" stopColor="#ff6a3d" />
            <stop offset="1" stopColor="#ffb547" />
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="url(#ring)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      {loading && isPlaying ? (
        <LoaderCircle className="size-5 animate-spin" />
      ) : isPlaying ? (
        <Pause className="size-5 fill-current" />
      ) : (
        <Play className="size-5 translate-x-[1px] fill-current" />
      )}
    </button>
  );
}

function LikeButton({ className = 'size-5' }: { className?: string }) {
  const t = useCurrent();
  const liked = useLibrary((s) => !!t && s.liked.some((x) => x.id === t.id));
  const toggleLike = useLibrary((s) => s.toggleLike);
  if (!t) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toast(toggleLike(t) ? 'Ajouté à tes coups de cœur' : 'Retiré de tes coups de cœur');
      }}
      className={`p-1.5 transition active:scale-75 ${liked ? 'text-accent' : 'text-white/60 hover:text-white'}`}
      aria-label="Coup de cœur"
    >
      <Heart className={`${className} ${liked ? 'fill-accent' : ''}`} />
    </button>
  );
}

function useModeButtons() {
  const { shuffle, repeat, toggleShuffle, cycleRepeat } = usePlayer();
  const on = 'bg-accent/15 text-accent';
  const off = 'text-white/60 hover:text-white';
  return {
    shuffle: (
      <button onClick={toggleShuffle} className={`grid size-10 place-items-center rounded-full transition ${shuffle ? on : off}`} aria-label="Aléatoire">
        <Shuffle className="size-[18px]" />
      </button>
    ),
    repeat: (
      <button onClick={cycleRepeat} className={`grid size-10 place-items-center rounded-full transition ${repeat !== 'off' ? on : off}`} aria-label="Répéter">
        {repeat === 'one' ? <Repeat1 className="size-[18px]" /> : <Repeat className="size-[18px]" />}
      </button>
    ),
  };
}

function Progress({ thick }: { thick?: boolean }) {
  const { position, duration, seek } = usePlayer();
  const [scrub, setScrub] = useState<number | null>(null);
  return (
    <div className="w-full">
      <Slider value={position} max={duration} onCommit={seek} onScrub={setScrub} thick={thick} />
      <div className="mt-1 flex justify-between font-display text-[11px] tabular-nums text-white/55">
        <span>{fmtTime(scrub ?? position)}</span>
        <span>-{fmtTime(Math.max(0, duration - (scrub ?? position)))}</span>
      </div>
    </div>
  );
}

/* --------------------------- Desktop --------------------------- */

export function PlayerBar() {
  const t = useCurrent();
  const { prev, next, volume, setVolume, setNowPlaying, isPlaying } = usePlayer();
  const modes = useModeButtons();
  const [lastVol, setLastVol] = useState(1);
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className="glass mx-2 mb-2 hidden h-[84px] grid-cols-[1fr_minmax(0,1.4fr)_1fr] items-center gap-4 rounded-[28px] px-3 md:grid">
      <div className="flex min-w-0 items-center gap-3">
        {t ? (
          <>
            <button onClick={() => setNowPlaying(true)} className="shrink-0 transition hover:scale-105">
              <Vinyl track={t} spinning={isPlaying} className="size-[60px]" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{t.title}</div>
              <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                <SourceIcon source={t.source} className="size-3" />
                {t.artist}
              </div>
            </div>
            <LikeButton className="size-4" />
          </>
        ) : (
          <span className="pl-3 text-sm text-muted">Rien en lecture pour l'instant</span>
        )}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          {modes.shuffle}
          <button onClick={prev} className="grid size-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white" aria-label="Précédent">
            <SkipBack className="size-5 fill-current" />
          </button>
          <PlayButton />
          <button onClick={() => next()} className="grid size-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white" aria-label="Suivant">
            <SkipForward className="size-5 fill-current" />
          </button>
          {modes.repeat}
        </div>
        <div className="w-full max-w-[560px]">
          <Progress />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 pr-2">
        <button onClick={() => setNowPlaying(true)} className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" aria-label="File d'attente">
          <ListMusic className="size-[18px]" />
        </button>
        <button
          onClick={() => {
            if (volume > 0) {
              setLastVol(volume);
              setVolume(0);
            } else setVolume(lastVol || 1);
          }}
          className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Volume"
        >
          <VolIcon className="size-[18px]" />
        </button>
        <Slider value={volume} max={1} onCommit={setVolume} onScrub={(v) => v !== null && setVolume(v)} className="w-28" />
      </div>
    </div>
  );
}

/* ---------------------------- Mobile ---------------------------- */

export function MiniPlayer() {
  const t = useCurrent();
  const { setNowPlaying, next, isPlaying } = usePlayer();
  const touch = useRef<number | null>(null);
  if (!t) return null;
  return (
    <div
      onClick={() => setNowPlaying(true)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
        if (dx < -70) next();
        touch.current = null;
      }}
      className="flex items-center gap-3 border-b border-white/[.06] px-2.5 pb-2.5 pt-2.5"
    >
      <Vinyl track={t} spinning={isPlaying} className="size-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold">{t.title}</div>
        <div className="flex items-center gap-1 truncate text-[12px] text-muted">
          <SourceIcon source={t.source} className="size-3" />
          {t.artist}
        </div>
      </div>
      <LikeButton className="size-[21px]" />
      <RingPlay />
    </div>
  );
}

/* ------------------------- Plein écran ------------------------- */

export function NowPlaying() {
  const t = useCurrent();
  const { nowPlayingOpen, setNowPlaying, prev, next, queue, index, playAt, removeFromQueue, isPlaying } = usePlayer();
  const openMenu = useUi((s) => s.openMenu);
  const [showQueue, setShowQueue] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const modes = useModeButtons();

  useEffect(() => {
    if (nowPlayingOpen && !showQueue && t?.source === 'youtube') engine.setVideoAnchor(anchor.current);
    else engine.setVideoAnchor(null);
    return () => engine.setVideoAnchor(null);
  }, [nowPlayingOpen, showQueue, t?.source, t?.id]);

  useEffect(() => {
    if (!nowPlayingOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNowPlaying(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nowPlayingOpen, setNowPlaying]);

  if (!nowPlayingOpen || !t) return null;
  const upNext = queue.slice(index + 1);

  return (
    <div className="animate-sheet fixed inset-0 z-[60] flex flex-col overflow-hidden bg-ink">
      {/* Fond : pochette floutée */}
      {t.artwork && <img src={t.artwork} alt="" className="absolute inset-0 size-full scale-150 object-cover opacity-80 blur-3xl saturate-[1.8]" />}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-ink/45 to-ink/95" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[.07] mix-blend-overlay" />

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),12px)]">
        <header className="flex items-center justify-between py-2">
          <button onClick={() => setNowPlaying(false)} className="glass grid size-10 place-items-center rounded-full" aria-label="Fermer">
            <ChevronDown className="size-6" />
          </button>
          <div className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold">
            {showQueue ? (
              "File d'attente"
            ) : (
              <>
                <SourceIcon source={t.source} className="size-4" />
                via {SOURCES[t.source].label}
              </>
            )}
          </div>
          <button onClick={() => openMenu(t)} className="glass grid size-10 place-items-center rounded-full" aria-label="Options">
            <MoreVertical className="size-5" />
          </button>
        </header>

        {showQueue ? (
          <div className="no-scrollbar -mx-2 mt-4 flex-1 overflow-y-auto">
            <h3 className="px-2 pb-2 font-display text-lg font-bold">En ce moment</h3>
            <div className="flex items-center gap-3 rounded-2xl bg-white/[.06] px-2 py-2">
              <Artwork track={t} className="size-12" />
              <div className="min-w-0 flex-1">
                <div className="text-sunset truncate font-bold">{t.title}</div>
                <div className="truncate text-sm text-white/70">{t.artist}</div>
              </div>
              <Equalizer playing={isPlaying} className="mr-2" />
            </div>
            <h3 className="px-2 pb-2 pt-6 font-display text-lg font-bold">Ensuite</h3>
            {upNext.length === 0 && <p className="px-2 text-sm text-white/60">Rien d'autre dans la file.</p>}
            {upNext.map((q, i) => (
              <div key={`${q.id}-${i}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/[.06]">
                <button onClick={() => playAt(index + 1 + i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <Artwork track={q} className="size-12 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{q.title}</div>
                    <div className="flex items-center gap-1.5 truncate text-sm text-white/65">
                      <SourceIcon source={q.source} className="size-3" /> {q.artist}
                    </div>
                  </div>
                </button>
                <button onClick={() => removeFromQueue(index + 1 + i)} className="p-2 text-white/50 hover:text-white" aria-label="Retirer">
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center py-6">
            {t.source === 'youtube' ? (
              <div ref={anchor} className="aspect-video w-full rounded-3xl bg-black/40 shadow-[0_30px_80px_rgba(0,0,0,.6)]" />
            ) : (
              <Vinyl track={t} spinning={isPlaying} className="w-full max-w-[min(100%,46dvh)]" />
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[26px] font-extrabold leading-tight tracking-tight">{t.title}</div>
            <div className="truncate text-base font-medium text-white/65">{t.artist}</div>
          </div>
          <LikeButton className="size-7" />
        </div>

        <div className="mt-5">
          <Progress thick />
        </div>

        <div className="mt-3 flex items-center justify-between">
          {modes.shuffle}
          <button onClick={prev} className="grid size-14 place-items-center rounded-full transition active:scale-90 active:bg-white/10" aria-label="Précédent">
            <SkipBack className="size-7 fill-current" />
          </button>
          <PlayButton size="lg" />
          <button onClick={() => next()} className="grid size-14 place-items-center rounded-full transition active:scale-90 active:bg-white/10" aria-label="Suivant">
            <SkipForward className="size-7 fill-current" />
          </button>
          {modes.repeat}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <a href={t.url} target="_blank" rel="noopener" className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white/75 hover:text-white">
            <SourceIcon source={t.source} className="size-4" /> Ouvrir sur {SOURCES[t.source].label}
          </a>
          <button
            onClick={() => setShowQueue((v) => !v)}
            className={`glass grid size-10 place-items-center rounded-full transition ${showQueue ? 'text-accent' : 'text-white/75 hover:text-white'}`}
            aria-label="File d'attente"
          >
            <ListMusic className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
