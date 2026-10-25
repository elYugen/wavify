import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, MoreVertical, Pencil, Plus, Search as SearchIcon, Shuffle, Trash2, X } from 'lucide-react';
import type { Playlist, Source, Track } from '../types';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { toast } from '../store/toast';
import { fmtTotal, plural } from '../lib/format';
import { useSearch } from '../lib/useSearch';
import { PlaylistCover } from '../components/PlaylistCover';
import { TrackRow } from '../components/TrackRow';
import { PlayCircle } from '../components/PlayCircle';
import { StickyBar } from '../components/PageHeader';
import { Sheet, SheetItem } from '../components/Sheet';
import { SourceTabs } from '../components/SourceTabs';
import { RowSkeleton } from '../components/Skeleton';
import { Vinyl } from '../components/Vinyl';

function AddTracks({ playlist }: { playlist: Playlist }) {
  const [q, setQ] = useState('');
  const [source, setSource] = useState<Source>('youtube');
  const { results, loading, error } = useSearch(source, q);
  const addTracks = useLibrary((s) => s.addTracks);
  const playQueue = usePlayer((s) => s.playQueue);
  const have = new Set(playlist.tracks.map((t) => t.id));
  const visible = results.filter((t) => !have.has(t.id));
  return (
    <section id="add-tracks" className="mx-3 mt-10 rounded-[28px] bg-white/[.03] px-3 pb-3 pt-6 ring-1 ring-white/[.06] md:mx-5 md:px-5">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-accent-2">Enrichir</p>
      <h2 className="font-display text-xl font-extrabold md:text-2xl">Ajoute des sons à ta playlist</h2>
      <label className="mt-4 flex max-w-md items-center gap-3 rounded-2xl bg-white/[.07] px-4 py-3 focus-within:ring-2 focus-within:ring-accent/70">
        <SearchIcon className="size-5 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher des titres" className="w-full bg-transparent outline-none placeholder:text-muted" />
        {q && (
          <button onClick={() => setQ('')} aria-label="Effacer">
            <X className="size-4 text-muted" />
          </button>
        )}
      </label>
      <SourceTabs value={source} onChange={setSource} className="mt-3" />
      <div className="-mx-1 mt-3 md:-mx-3">
        {loading && <RowSkeleton count={5} />}
        {!loading && error && <p className="px-2 py-4 text-sm text-red-300">{error}</p>}
        {!loading &&
          visible.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              onPlay={() => playQueue(visible, i)}
              action="add"
              onAction={() => {
                addTracks(playlist.id, [t]);
                toast(`Ajouté à « ${playlist.name} »`);
              }}
            />
          ))}
      </div>
    </section>
  );
}

function EditSheet({ playlist, open, onClose }: { playlist: Playlist; open: boolean; onClose: () => void }) {
  const update = useLibrary((s) => s.updatePlaylist);
  const [name, setName] = useState(playlist.name);
  const [desc, setDesc] = useState(playlist.description);
  return (
    <Sheet open={open} onClose={onClose} title={<div className="font-display text-xl font-bold">Modifier la playlist</div>}>
      <form
        className="space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          update(playlist.id, { name: name.trim() || playlist.name, description: desc });
          toast('Playlist mise à jour');
          onClose();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl bg-white/[.06] px-4 py-3 font-display text-lg font-bold outline-none focus:ring-2 focus:ring-accent/60" placeholder="Nom" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full resize-none rounded-2xl bg-white/[.06] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/60" placeholder="Description" />
        <button className="bg-sunset w-full rounded-full py-3 font-bold text-on-accent transition active:scale-95">Enregistrer</button>
      </form>
    </Sheet>
  );
}

export default function PlaylistPage({ liked = false }: { liked?: boolean }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === id));
  const likedTracks = useLibrary((s) => s.liked);
  const { deletePlaylist, moveTrack } = useLibrary();
  const { playQueue, toggle, toggleShuffle } = usePlayer();
  const contextId = liked ? 'liked' : id;
  const isContext = usePlayer((s) => s.contextId === contextId);
  const isPlaying = usePlayer((s) => s.isPlaying && s.contextId === contextId);
  const shuffle = usePlayer((s) => s.shuffle);
  const current = usePlayer((s) => s.queue[s.index] ?? null);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [reorder, setReorder] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const tracks: Track[] = liked ? likedTracks : playlist?.tracks || [];
  const total = useMemo(() => tracks.reduce((a, t) => a + (t.duration || 0), 0), [tracks]);

  if (!liked && !playlist)
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="text-xl font-bold">Playlist introuvable</p>
          <button onClick={() => navigate('/library')} className="bg-sunset mt-4 rounded-full px-5 py-2 font-bold text-on-accent">Retour à la collection</button>
        </div>
      </div>
    );

  const name = liked ? 'Coups de cœur' : playlist!.name;
  const backdrop = tracks.find((t) => t.artwork)?.artwork || (!liked && playlist!.cover) || '';
  const playAll = () => (isContext ? toggle() : playQueue(tracks, 0, contextId));
  const shufflePlay = () => {
    if (!tracks.length) return;
    if (!shuffle) toggleShuffle();
    playQueue(tracks, Math.floor(Math.random() * tracks.length), contextId);
  };
  const vinylTrack = (isContext && current) || tracks[0] || null;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        {backdrop ? (
          <img src={backdrop} alt="" className="size-full scale-125 object-cover opacity-45 blur-3xl saturate-150" />
        ) : (
          <div className="bg-sunset size-full opacity-25 blur-3xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-base/10 via-base/70 to-base" />
      </div>
      <StickyBar title={name} />

      <header className="relative flex flex-col items-center gap-6 px-4 pb-4 pt-2 md:flex-row md:items-end md:px-7 md:pt-4">
        <div className="relative mr-14 shrink-0 md:mr-20">
          <Vinyl track={vinylTrack} spinning={isPlaying} className="absolute left-[34%] top-[4%] size-[92%] transition-all duration-700" />
          <PlaylistCover playlist={playlist} liked={liked} rounded="rounded-3xl" className="relative size-[200px] shadow-[0_24px_60px_rgba(0,0,0,.55)] md:size-[220px]" />
        </div>
        <div className="w-full min-w-0 text-center md:text-left">
          <p className="text-[11px] font-bold uppercase tracking-[.22em] text-accent-2">{liked ? 'Tes favoris' : playlist!.importedFrom ? 'Importée de Spotify' : 'Playlist'}</p>
          <h1 className="mt-1 line-clamp-2 font-display text-[34px] font-extrabold leading-[1.02] tracking-tight md:text-[clamp(2.75rem,5.5vw,4.75rem)]">{name}</h1>
          {!liked && playlist!.description && <p className="mt-2 text-sm text-white/70">{playlist!.description}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
            <span className="rounded-full bg-white/[.08] px-3 py-1 text-xs font-bold">{plural(tracks.length, 'titre')}</span>
            {total > 0 && <span className="rounded-full bg-white/[.08] px-3 py-1 text-xs font-bold">{fmtTotal(total)}</span>}
          </div>
        </div>
      </header>

      <div className="relative flex items-center gap-2 px-4 py-4 md:px-7">
        <PlayCircle playing={isPlaying} onClick={playAll} label className="text-[15px]" icon="size-5" />
        <button onClick={shufflePlay} className={`grid size-12 place-items-center rounded-full ring-1 transition ${shuffle && isContext ? 'bg-accent/15 text-accent ring-accent/40' : 'text-white/80 ring-white/15 hover:ring-white/40'}`} aria-label="Lecture aléatoire">
          <Shuffle className="size-5" />
        </button>
        <div className="flex-1" />
        {!liked && (
          <button
            onClick={() => addRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="grid size-12 place-items-center rounded-full text-white/80 ring-1 ring-white/15 transition hover:ring-white/40"
            aria-label="Ajouter des titres"
          >
            <Plus className="size-5" />
          </button>
        )}
        {!liked && (
          <button onClick={() => setMenu(true)} className="grid size-12 place-items-center rounded-full text-white/80 ring-1 ring-white/15 transition hover:ring-white/40" aria-label="Options">
            <MoreVertical className="size-5" />
          </button>
        )}
      </div>

      <div className="relative px-2 md:px-3">
        {reorder && (
          <div className="mx-2 mb-2 flex items-center justify-between rounded-2xl bg-white/[.06] px-4 py-3 text-sm">
            Réorganise les titres avec les flèches.
            <button onClick={() => setReorder(false)} className="bg-sunset rounded-full px-3 py-1 font-bold text-on-accent">Terminé</button>
          </div>
        )}
        {tracks.map((t, i) =>
          reorder ? (
            <div key={t.id} className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-white/5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t.title}</div>
                <div className="truncate text-sm text-muted">{t.artist}</div>
              </div>
              <button disabled={i === 0} onClick={() => moveTrack(id, i, i - 1)} className="p-2 disabled:opacity-25" aria-label="Monter">
                <ArrowUp className="size-5" />
              </button>
              <button disabled={i === tracks.length - 1} onClick={() => moveTrack(id, i, i + 1)} className="p-2 disabled:opacity-25" aria-label="Descendre">
                <ArrowDown className="size-5" />
              </button>
            </div>
          ) : (
            <TrackRow key={t.id} track={t} index={i} showIndex playlistId={liked ? undefined : id} onPlay={() => playQueue(tracks, i, contextId)} />
          ),
        )}
        {liked && !tracks.length && (
          <div className="px-4 py-16 text-center">
            <p className="font-display text-2xl font-extrabold">Pas encore de coup de cœur</p>
            <p className="mt-2 text-muted">Touche le cœur d'un titre pour le retrouver ici.</p>
            <button onClick={() => navigate('/search')} className="bg-sunset mt-6 rounded-full px-6 py-3 font-bold text-on-accent">Explorer</button>
          </div>
        )}
      </div>

      {!liked && (
        <div ref={addRef}>
          <AddTracks playlist={playlist!} />
        </div>
      )}

      {!liked && (
        <>
          <Sheet open={menu} onClose={() => setMenu(false)} title={<div className="flex items-center gap-3"><PlaylistCover playlist={playlist} className="size-12" rounded="rounded-xl" /><span className="truncate font-display text-lg font-bold">{name}</span></div>}>
            <div className="py-1">
              <SheetItem icon={<Pencil />} label="Modifier les infos" onClick={() => (setMenu(false), setEdit(true))} />
              {tracks.length > 1 && <SheetItem icon={<ArrowDown />} label="Réorganiser les titres" onClick={() => (setMenu(false), setReorder(true))} />}
              <SheetItem
                icon={<Trash2 />}
                label="Supprimer la playlist"
                danger
                onClick={() => {
                  if (!confirm(`Supprimer « ${name} » ?`)) return;
                  deletePlaylist(id);
                  toast('Playlist supprimée');
                  navigate('/library', { replace: true });
                }}
              />
            </div>
          </Sheet>
          {edit && <EditSheet playlist={playlist!} open={edit} onClose={() => setEdit(false)} />}
        </>
      )}
    </div>
  );
}
