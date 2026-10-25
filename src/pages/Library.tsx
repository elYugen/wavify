import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, Download, Plus } from 'lucide-react';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import { plural } from '../lib/format';
import { PlaylistCover } from '../components/PlaylistCover';
import { Equalizer } from '../components/Equalizer';

type Filter = 'all' | 'mine' | 'imported';
type Sort = 'recent' | 'alpha';

export default function Library() {
  const { playlists, liked } = useLibrary();
  const openCreate = useUi((s) => s.openCreate);
  const contextId = usePlayer((s) => s.contextId);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');

  const list = playlists
    .filter((p) => (filter === 'all' ? true : filter === 'imported' ? !!p.importedFrom : !p.importedFrom))
    .sort((a, b) => (sort === 'alpha' ? a.name.localeCompare(b.name, 'fr') : (b.playedAt || b.updatedAt) - (a.playedAt || a.updatedAt)));

  const chip = (f: Filter, label: string) => (
    <button
      onClick={() => setFilter(filter === f ? 'all' : f)}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition ${filter === f ? 'bg-white text-ink' : 'bg-white/[.06] text-white/80 ring-1 ring-white/[.06] hover:bg-white/10'}`}
    >
      {label}
    </button>
  );

  const Item = ({ to, id, cover, title, sub }: { to: string; id: string; cover: React.ReactNode; title: string; sub: string }) => (
    <Link to={to} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[.05] active:bg-white/[.08]">
      {cover}
      <div className="min-w-0 flex-1">
        <div className={`truncate font-display text-[16px] font-bold ${contextId === id ? 'text-sunset' : ''}`}>{title}</div>
        <div className="truncate text-sm text-muted">{sub}</div>
      </div>
      {contextId === id && <Equalizer playing={isPlaying} className="mr-2" />}
    </Link>
  );

  return (
    <div>
      <div className="sticky top-0 z-20 bg-base/85 px-4 pb-3 pt-[max(env(safe-area-inset-top),18px)] backdrop-blur-xl md:px-7 md:pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[32px] font-extrabold leading-none tracking-tight">Collection<span className="text-sunset">.</span></h1>
          <div className="flex gap-2">
            <Link to="/import" className="grid size-11 place-items-center rounded-2xl bg-white/[.06] transition hover:bg-white/10" aria-label="Importer">
              <Download className="size-5" />
            </Link>
            <button onClick={() => openCreate()} className="bg-sunset grid size-11 place-items-center rounded-2xl text-on-accent transition active:scale-90" aria-label="Créer">
              <Plus className="size-6" />
            </button>
          </div>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {chip('mine', 'Créées par moi')}
          {chip('imported', 'Importées')}
        </div>
      </div>
      <div className="px-2 md:px-5">
        <button onClick={() => setSort(sort === 'recent' ? 'alpha' : 'recent')} className="mb-1 flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-[.15em] text-muted">
          <ArrowDownUp className="size-4" /> {sort === 'recent' ? 'Récents' : 'Ordre alphabétique'}
        </button>
        {filter === 'all' && (
          <Item to="/liked" id="liked" cover={<PlaylistCover liked className="size-16" rounded="rounded-2xl" />} title="Coups de cœur" sub={`Playlist · ${plural(liked.length, 'titre')}`} />
        )}
        {list.map((p) => (
          <Item key={p.id} to={`/playlist/${p.id}`} id={p.id} cover={<PlaylistCover playlist={p} className="size-16" rounded="rounded-2xl" />} title={p.name} sub={`Playlist · ${plural(p.tracks.length, 'titre')}`} />
        ))}
        <button onClick={() => openCreate()} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/[.05]">
          <span className="grid size-16 place-items-center rounded-2xl border-2 border-dashed border-white/15 text-muted">
            <Plus className="size-7" />
          </span>
          <span className="font-display font-bold">Nouvelle playlist</span>
        </button>
      </div>
    </div>
  );
}
