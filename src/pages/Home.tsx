import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Download, Plus, Search } from 'lucide-react';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import { greeting, plural } from '../lib/format';
import { GENRES } from '../lib/genres';
import { SOURCES } from '../lib/sources';
import type { Playlist, Track } from '../types';
import { PlaylistCover } from '../components/PlaylistCover';
import { Artwork } from '../components/Artwork';
import { PlayCircle } from '../components/PlayCircle';
import { Logo } from '../components/Logo';
import { SourceIcon } from '../components/SourceIcon';
import { MoodChip } from '../components/MoodChip';
import { Vinyl } from '../components/Vinyl';

const today = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function ResumeHero() {
  const t = usePlayer((s) => s.queue[s.index] ?? null);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { toggle, setNowPlaying } = usePlayer();
  const navigate = useNavigate();

  if (!t)
    return (
      <div className="relative overflow-hidden rounded-[28px] bg-surface p-6 ring-1 ring-white/[.06]">
        <div className="bg-sunset absolute -right-16 -top-16 size-56 rounded-full opacity-40 blur-3xl" />
        <div className="relative max-w-sm">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-accent-2">Bienvenue</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight">Toute la musique gratuite, au même endroit.</h2>
          <p className="mt-2 text-sm text-muted">Cherche sur YouTube, SoundCloud et Audius, puis range tout dans tes playlists.</p>
          <button onClick={() => navigate('/search')} className="bg-sunset mt-5 flex items-center gap-2 rounded-full px-5 py-3 font-bold text-on-accent">
            <Search className="size-5" /> Commencer à explorer
          </button>
        </div>
      </div>
    );

  return (
    <div onClick={() => setNowPlaying(true)} className="group relative cursor-pointer overflow-hidden rounded-[28px] ring-1 ring-white/[.08]">
      {t.artwork && <img src={t.artwork} alt="" className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-2xl saturate-150" />}
      <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/60 to-ink/20" />
      <div className="relative flex items-center gap-4 p-4 md:gap-6 md:p-6">
        <div className="relative shrink-0">
          <Vinyl track={t} spinning={isPlaying} className="absolute left-[38%] top-0 size-[104px] md:size-[150px]" />
          <Artwork track={t} rounded="rounded-2xl" className="relative size-[104px] shadow-2xl md:size-[150px]" />
        </div>
        <div className="min-w-0 flex-1 pl-8 md:pl-14">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-accent-2">{isPlaying ? 'En écoute' : 'Reprendre'}</p>
          <h2 className="mt-1 line-clamp-2 font-display text-xl font-extrabold leading-tight md:text-3xl">{t.title}</h2>
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-white/70">
            <SourceIcon source={t.source} className="size-3.5" /> {t.artist}
          </p>
        </div>
        <PlayCircle playing={isPlaying} onClick={toggle} className="size-12 md:size-14" />
      </div>
    </div>
  );
}

function PlaylistCard({ p }: { p: Playlist }) {
  const navigate = useNavigate();
  const active = usePlayer((s) => s.contextId === p.id && s.isPlaying);
  const { playQueue, toggle, contextId } = usePlayer();
  return (
    <div onClick={() => navigate(`/playlist/${p.id}`)} className="group w-[148px] shrink-0 cursor-pointer md:w-[172px]">
      <div className="relative">
        <div className="absolute inset-x-3 -top-2 h-full rounded-2xl bg-white/[.06] transition group-hover:-top-3" />
        <PlaylistCover playlist={p} className="relative aspect-square w-full shadow-xl" />
        {p.tracks.length > 0 && (
          <PlayCircle
            playing={active}
            onClick={() => (contextId === p.id ? toggle() : playQueue(p.tracks, 0, p.id))}
            className={`absolute bottom-2 right-2 size-11 transition-all ${active ? 'opacity-100' : 'opacity-100 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100'}`}
            icon="size-5"
          />
        )}
      </div>
      <div className={`mt-2.5 truncate font-display text-[15px] font-bold ${active ? 'text-sunset' : ''}`}>{p.name}</div>
      <div className="truncate text-[13px] text-muted">{plural(p.tracks.length, 'titre')}</div>
    </div>
  );
}

function RecentItem({ t, onPlay }: { t: Track; onPlay: () => void }) {
  const current = usePlayer((s) => s.queue[s.index]?.id === t.id);
  return (
    <button onClick={onPlay} className="group w-[120px] shrink-0 text-left md:w-[140px]">
      <div className="relative">
        <Artwork track={t} rounded="rounded-full" className={`aspect-square w-full shadow-lg ring-2 transition group-hover:scale-[1.03] ${current ? 'ring-accent' : 'ring-white/[.06]'}`} />
        <span className="absolute bottom-1 right-1 rounded-full bg-ink p-1 ring-2 ring-base">
          <SourceIcon source={t.source} className="size-3.5" />
        </span>
      </div>
      <div className={`mt-2 truncate text-center text-[13px] font-bold ${current ? 'text-sunset' : ''}`}>{t.title}</div>
      <div className="truncate text-center text-xs text-muted">{t.artist}</div>
    </button>
  );
}

function Section({ title, kicker, children, more }: { title: string; kicker?: string; children: React.ReactNode; more?: React.ReactNode }) {
  return (
    <section className="mt-9">
      <div className="mb-4 flex items-end justify-between px-4 md:px-7">
        <div>
          {kicker && <p className="text-[11px] font-bold uppercase tracking-[.2em] text-muted">{kicker}</p>}
          <h2 className="font-display text-[22px] font-extrabold tracking-tight">{title}</h2>
        </div>
        {more}
      </div>
      {children}
    </section>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2 pt-2 md:gap-5 md:px-7">{children}</div>
);

export default function Home() {
  const { playlists, liked, recent } = useLibrary();
  const openCreate = useUi((s) => s.openCreate);
  const playQueue = usePlayer((s) => s.playQueue);
  const sorted = [...playlists].sort((a, b) => (b.playedAt || b.updatedAt) - (a.playedAt || a.updatedAt));

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden">
        <div className="bg-sunset absolute -left-24 -top-40 size-96 rounded-full opacity-[.18] blur-3xl" />
        <div className="absolute -right-20 -top-24 size-80 rounded-full bg-lilac opacity-[.12] blur-3xl" />
      </div>
      <div className="relative">
        <header className="flex items-start justify-between px-4 pb-1 pt-[max(env(safe-area-inset-top),18px)] md:px-7 md:pt-7">
          <div>
            <div className="mb-4 md:hidden">
              <Logo />
            </div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-muted first-letter:uppercase">{today()}</p>
            <h1 className="mt-1 font-display text-[32px] font-extrabold leading-none tracking-tight md:text-5xl">
              {greeting()}<span className="text-sunset">.</span>
            </h1>
          </div>
          <button onClick={() => openCreate()} className="bg-sunset mt-1 grid size-11 place-items-center rounded-2xl text-on-accent shadow-[0_10px_30px_-8px_rgba(255,106,61,.7)] transition active:scale-90" aria-label="Créer une playlist">
            <Plus className="size-6" />
          </button>
        </header>

        <div className="animate-rise mt-6 px-4 md:px-7">
          <ResumeHero />
        </div>

        <div className="animate-rise mt-3 grid grid-cols-2 gap-3 px-4 [animation-delay:80ms] md:px-7">
          <button onClick={() => openCreate()} className="group flex items-center gap-3 rounded-[22px] bg-white/[.04] p-3 text-left ring-1 ring-white/[.06] transition hover:bg-white/[.07] active:scale-[.98]">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lilac/15 text-lilac">
              <Plus className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display font-bold">Nouvelle playlist</span>
              <span className="block truncate text-xs text-muted">Mixe toutes les sources</span>
            </span>
          </button>
          <Link to="/import" className="group flex items-center gap-3 rounded-[22px] bg-white/[.04] p-3 ring-1 ring-white/[.06] transition hover:bg-white/[.07] active:scale-[.98]">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#1db954]/15 text-[#1ed760]">
              <Download className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display font-bold">Depuis Spotify</span>
              <span className="block truncate text-xs text-muted">Importe un lien</span>
            </span>
          </Link>
        </div>

        <Section title="Tes playlists" kicker="Collection" more={<Link to="/library" className="flex items-center gap-1 text-sm font-bold text-muted hover:text-white">Tout <ArrowUpRight className="size-4" /></Link>}>
          <Row>
            <div className="w-[148px] shrink-0 md:w-[172px]">
              <Link to="/liked" className="block">
                <PlaylistCover liked className="aspect-square w-full shadow-xl" />
                <div className="mt-2.5 font-display text-[15px] font-bold">Coups de cœur</div>
                <div className="text-[13px] text-muted">{plural(liked.length, 'titre')}</div>
              </Link>
            </div>
            {sorted.map((p) => (
              <PlaylistCard key={p.id} p={p} />
            ))}
            {!sorted.length && (
              <button onClick={() => openCreate()} className="grid aspect-square w-[148px] shrink-0 place-items-center rounded-2xl border-2 border-dashed border-white/15 text-muted transition hover:border-accent hover:text-accent md:w-[172px]">
                <span className="text-center text-sm font-bold">
                  <Plus className="mx-auto mb-1 size-7" />
                  Créer
                </span>
              </button>
            )}
          </Row>
        </Section>

        {recent.length > 0 && (
          <Section title="Écoutés récemment" kicker="Historique">
            <Row>
              {recent.slice(0, 15).map((t, i) => (
                <RecentItem key={t.id} t={t} onPlay={() => playQueue(recent.slice(0, 15), i)} />
              ))}
            </Row>
          </Section>
        )}

        <Section title="Selon ton humeur" kicker="Explorer">
          <div className="grid grid-cols-2 gap-2.5 px-4 sm:grid-cols-3 md:px-7 lg:grid-cols-4">
            {GENRES.map((g) => (
              <MoodChip key={g.label} g={g} to={`/search?q=${encodeURIComponent(g.q)}`} />
            ))}
          </div>
        </Section>

        <p className="mt-10 px-4 text-center text-xs text-muted md:px-7">
          Sources : {Object.values(SOURCES).map((s) => s.label).join(' · ')}
        </p>
      </div>
    </div>
  );
}
