import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Compass, Download, House, Library, Plus } from 'lucide-react';
import { useLibrary } from '../store/library';
import { useUi } from '../store/ui';
import { usePlayer } from '../store/player';
import { plural } from '../lib/format';
import { PlaylistCover } from './PlaylistCover';
import { Equalizer } from './Equalizer';
import { MiniPlayer, NowPlaying, PlayerBar } from './Player';
import { Overlays } from './Overlays';
import { Logo } from './Logo';
import { AccountButton } from './AccountButton';

const NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/search', label: 'Explorer', icon: Compass },
  { to: '/library', label: 'Collection', icon: Library },
  { to: '/import', label: 'Importer', icon: Download },
];

function Sidebar() {
  const playlists = useLibrary((s) => s.playlists);
  const liked = useLibrary((s) => s.liked);
  const openCreate = useUi((s) => s.openCreate);
  const contextId = usePlayer((s) => s.contextId);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const navigate = useNavigate();
  return (
    <aside className="hidden w-[290px] shrink-0 flex-col gap-2 md:flex">
      <div className="glass rounded-[28px] p-3">
        <div className="mb-3 flex items-center justify-between px-2 pt-1">
          <Logo />
          <AccountButton className="size-10" />
        </div>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3.5 rounded-2xl px-3 py-2.5 font-bold transition ${isActive ? 'bg-white/[.08] text-white' : 'text-muted hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`grid size-8 place-items-center rounded-xl ${isActive ? 'bg-sunset text-on-accent' : 'bg-white/[.05]'}`}>
                  <Icon className="size-[18px]" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div className="glass flex min-h-0 flex-1 flex-col rounded-[28px]">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <span className="font-display text-lg font-bold">Tes playlists</span>
          <button onClick={() => openCreate()} className="bg-sunset grid size-8 place-items-center rounded-full text-on-accent transition hover:scale-110" aria-label="Créer une playlist">
            <Plus className="size-5" />
          </button>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-2 pb-2">
          <SideItem to="/liked" playing={contextId === 'liked' && isPlaying} cover={<PlaylistCover liked className="size-11" rounded="rounded-xl" />} title="Coups de cœur" sub={plural(liked.length, 'titre')} />
          {playlists.map((p) => (
            <SideItem
              key={p.id}
              to={`/playlist/${p.id}`}
              playing={contextId === p.id && isPlaying}
              cover={<PlaylistCover playlist={p} className="size-11" rounded="rounded-xl" />}
              title={p.name}
              sub={plural(p.tracks.length, 'titre')}
            />
          ))}
          {!playlists.length && (
            <div className="m-2 rounded-2xl border border-dashed border-white/15 p-4">
              <p className="font-display font-bold">Ta collection est vide</p>
              <p className="mt-1 text-sm text-muted">Crée une playlist ou ramène celles de Spotify.</p>
              <button onClick={() => openCreate()} className="bg-sunset mt-4 rounded-full px-4 py-2 text-sm font-bold text-on-accent">
                Nouvelle playlist
              </button>
              <button onClick={() => navigate('/import')} className="mt-2 block text-sm font-semibold text-muted hover:text-white">
                Importer de Spotify →
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function SideItem({ to, cover, title, sub, playing }: { to: string; cover: React.ReactNode; title: string; sub: string; playing: boolean }) {
  return (
    <NavLink to={to} className={({ isActive }) => `flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[.05] ${isActive ? 'bg-white/[.08]' : ''}`}>
      {cover}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[14px] font-bold ${playing ? 'text-sunset' : ''}`}>{title}</div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>
      {playing && <Equalizer className="mr-2" />}
    </NavLink>
  );
}

/** Dock mobile flottant : mini-lecteur + navigation dans une seule capsule. */
function Dock() {
  return (
    <div className="px-3 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden">
      <div className="glass overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,.6)]">
        <MiniPlayer />
        <nav className="flex items-center justify-around p-1.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="flex-1">
              {({ isActive }) => (
                <span
                  className={`mx-auto flex h-11 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-bold transition-all active:scale-95 ${
                    isActive ? 'bg-sunset w-full max-w-[124px] text-on-accent' : 'w-11 text-white/60'
                  }`}
                >
                  <Icon className="size-[21px] shrink-0" />
                  {isActive && <span className="truncate">{label}</span>}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    main.current?.scrollTo(0, 0);
    setScrolled(false);
  }, [pathname]);
  return (
    <div className="flex h-dvh flex-col bg-ink md:p-2 md:pb-0">
      <div className="flex min-h-0 flex-1 gap-2">
        <Sidebar />
        <main
          ref={main}
          onScroll={(e) => setScrolled((e.target as HTMLElement).scrollTop > 40)}
          data-scrolled={scrolled}
          className="group/main relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-base pb-48 md:rounded-[28px] md:pb-6"
        >
          <Outlet />
        </main>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 md:static md:pt-2">
        <Dock />
        <PlayerBar />
      </div>
      <NowPlaying />
      <Overlays />
    </div>
  );
}
