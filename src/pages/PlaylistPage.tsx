import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, Images, ImagePlus, ListChecks, MoreVertical, Pencil, RotateCcw, Search as SearchIcon, Shuffle, Trash2, Upload, X } from 'lucide-react';
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
import { Artwork } from '../components/Artwork';
import { coverFromArtwork, squareImage } from '../lib/image';

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
  const { updatePlaylist, deletePlaylist } = useLibrary();
  const navigate = useNavigate();
  const [name, setName] = useState(playlist.name);
  const [desc, setDesc] = useState(playlist.description);
  const [cover, setCover] = useState<string | undefined>(playlist.cover);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const arts = playlist.tracks.filter((t, i, all) => t.artwork && all.findIndex((x) => x.artwork === t.artwork) === i).slice(0, 24);
  const preview: Playlist = { ...playlist, cover };

  const upload = async (f?: File) => {
    if (!f) return;
    try {
      setCover(await squareImage(f));
      setPicking(false);
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={<div className="font-display text-xl font-bold">Modifier la playlist</div>}>
      <form
        className="space-y-4 p-5 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          updatePlaylist(playlist.id, { name: name.trim() || playlist.name, description: desc.trim(), cover });
          toast('Playlist mise à jour');
          onClose();
        }}
      >
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setPicking((v) => !v)} className="group relative shrink-0" aria-label="Changer la miniature">
            <PlaylistCover playlist={preview} className="size-28 shadow-xl" />
            <span className="absolute inset-0 grid place-items-center rounded-2xl bg-ink/55 opacity-0 transition group-hover:opacity-100">
              <ImagePlus className="size-7" />
            </span>
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-muted">Miniature</p>
            <button type="button" onClick={() => file.current?.click()} className="flex w-full items-center gap-2 rounded-xl bg-white/[.07] px-3 py-2 text-sm font-bold transition hover:bg-white/[.12]">
              <Upload className="size-4 text-accent-2" /> Choisir une photo
            </button>
            {arts.length > 0 && (
              <button type="button" onClick={() => setPicking((v) => !v)} className="flex w-full items-center gap-2 rounded-xl bg-white/[.07] px-3 py-2 text-sm font-bold transition hover:bg-white/[.12]">
                <Images className="size-4 text-accent-2" /> Pochette d'un titre
              </button>
            )}
            {cover && (
              <button type="button" onClick={() => setCover(undefined)} className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-white">
                <RotateCcw className="size-4" /> Mosaïque automatique
              </button>
            )}
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => (upload(e.target.files?.[0]), (e.target.value = ''))} />
        </div>

        {picking && arts.length > 0 && (
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white/[.03] p-2 sm:grid-cols-6">
            {arts.map((t) => {
              const url = coverFromArtwork(t.artwork);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => (setCover(url), setPicking(false))}
                  className={`overflow-hidden rounded-xl ring-2 transition hover:scale-105 ${cover === url ? 'ring-accent' : 'ring-transparent'}`}
                >
                  <img src={url} alt={t.title} className="aspect-square w-full object-cover" />
                </button>
              );
            })}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[.18em] text-muted">Nom</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="w-full rounded-2xl bg-white/[.06] px-4 py-3 font-display text-lg font-bold outline-none focus:ring-2 focus:ring-accent/60" placeholder="Nom de la playlist" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[.18em] text-muted">Description</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={300} className="w-full resize-none rounded-2xl bg-white/[.06] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/60" placeholder="Facultatif" />
        </label>
        <button className="bg-sunset w-full rounded-full py-3 font-bold text-on-accent transition active:scale-95">Enregistrer</button>

        <div className="border-t border-white/[.07] pt-4">
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-500/10">
              <Trash2 className="size-4" /> Supprimer la playlist
            </button>
          ) : (
            <div className="rounded-2xl bg-red-500/10 p-4 text-center ring-1 ring-red-400/25">
              <p className="text-sm font-semibold">Supprimer « {playlist.name} » et ses {plural(playlist.tracks.length, 'titre')} ?</p>
              <p className="mt-1 text-xs text-muted">Cette action est définitive.</p>
              <div className="mt-3 flex justify-center gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15">Annuler</button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    deletePlaylist(playlist.id);
                    toast('Playlist supprimée');
                    navigate('/library', { replace: true });
                  }}
                  className="rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400"
                >
                  Oui, supprimer
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
}

/** Ligne en mode édition : sélection, déplacement, suppression. */
function EditRow({
  track, index, count, selected, onToggle, onMove, onRemove,
}: {
  track: Track; index: number; count: number; selected: boolean;
  onToggle: () => void; onMove?: (to: number) => void; onRemove: () => void;
}) {
  return (
    <div onClick={onToggle} className={`flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 transition md:px-3 ${selected ? 'bg-accent/[.12]' : 'hover:bg-white/[.04]'}`}>
      <span className={`grid size-6 shrink-0 place-items-center rounded-full ring-2 transition ${selected ? 'bg-sunset text-on-accent ring-transparent' : 'ring-white/25'}`}>
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
      <Artwork track={track} className="size-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{track.title}</div>
        <div className="truncate text-[13px] text-muted">{track.artist}</div>
      </div>
      {onMove && (
        <>
          <button disabled={index === 0} onClick={(e) => (e.stopPropagation(), onMove(index - 1))} className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10 disabled:opacity-20" aria-label="Monter">
            <ArrowUp className="size-[18px]" />
          </button>
          <button disabled={index === count - 1} onClick={(e) => (e.stopPropagation(), onMove(index + 1))} className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10 disabled:opacity-20" aria-label="Descendre">
            <ArrowDown className="size-[18px]" />
          </button>
        </>
      )}
      <button onClick={(e) => (e.stopPropagation(), onRemove())} className="hidden size-9 place-items-center rounded-full text-red-300/80 hover:bg-red-500/10 hover:text-red-300 sm:grid" aria-label="Retirer">
        <Trash2 className="size-[18px]" />
      </button>
    </div>
  );
}

export default function PlaylistPage({ liked = false }: { liked?: boolean }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === id));
  const likedTracks = useLibrary((s) => s.liked);
  const { moveTrack, removeTracks, unlikeMany, deletePlaylist } = useLibrary();
  const { playQueue, toggle, toggleShuffle } = usePlayer();
  const contextId = liked ? 'liked' : id;
  const isContext = usePlayer((s) => s.contextId === contextId);
  const isPlaying = usePlayer((s) => s.isPlaying && s.contextId === contextId);
  const shuffle = usePlayer((s) => s.shuffle);
  const current = usePlayer((s) => s.queue[s.index] ?? null);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [editing, setEditing] = useState(false); // mode édition des titres
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [askDelete, setAskDelete] = useState(false);
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
  const backdrop = (!liked && playlist!.cover) || tracks.find((t) => t.artwork)?.artwork || '';
  const removeMany = (ids: string[]) => {
    if (!ids.length) return;
    if (liked) unlikeMany(ids);
    else removeTracks(id, ids);
    setSelected((s) => new Set([...s].filter((x) => !ids.includes(x))));
    toast(ids.length > 1 ? `${ids.length} titres retirés` : 'Titre retiré');
  };
  const toggleSel = (tid: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(tid)) n.delete(tid);
      else n.add(tid);
      return n;
    });
  const stopEditing = () => {
    setEditing(false);
    setSelected(new Set());
  };
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
          <button onClick={() => !liked && setEdit(true)} className={`group relative block ${liked ? 'cursor-default' : ''}`} aria-label="Modifier la miniature">
            <PlaylistCover playlist={playlist} liked={liked} rounded="rounded-3xl" className="relative size-[200px] shadow-[0_24px_60px_rgba(0,0,0,.55)] md:size-[220px]" />
            {!liked && (
              <span className="absolute inset-0 grid place-items-center rounded-3xl bg-ink/55 opacity-0 transition group-hover:opacity-100">
                <span className="flex items-center gap-2 text-sm font-bold"><Pencil className="size-4" /> Modifier</span>
              </span>
            )}
          </button>
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

      {editing ? (
        <div className="sticky top-[calc(max(env(safe-area-inset-top),8px)+52px)] z-20 mx-3 my-3 flex items-center gap-2 rounded-full bg-surface/90 p-1.5 pl-4 ring-1 ring-white/10 backdrop-blur-xl md:mx-5">
          <span className="min-w-0 flex-1 truncate text-sm font-bold">
            {selected.size ? `${plural(selected.size, 'titre')} sélectionné${selected.size > 1 ? 's' : ''}` : 'Touche les titres à retirer'}
          </span>
          <button
            onClick={() => setSelected(selected.size === tracks.length ? new Set() : new Set(tracks.map((t) => t.id)))}
            className="rounded-full px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
          >
            {selected.size === tracks.length && tracks.length ? 'Aucun' : 'Tout'}
          </button>
          <button
            disabled={!selected.size}
            onClick={() => removeMany([...selected])}
            className="flex items-center gap-1.5 rounded-full bg-red-500 px-3.5 py-2 text-xs font-bold text-white transition enabled:hover:bg-red-400 disabled:opacity-30"
          >
            <Trash2 className="size-4" /> Retirer
          </button>
          <button onClick={stopEditing} className="bg-sunset rounded-full px-4 py-2 text-xs font-bold text-on-accent">OK</button>
        </div>
      ) : (
        <div className="relative flex items-center gap-2 px-4 py-4 md:px-7">
          <PlayCircle playing={isPlaying} onClick={playAll} label className="text-[15px]" icon="size-5" />
          <button onClick={shufflePlay} className={`grid size-12 place-items-center rounded-full ring-1 transition ${shuffle && isContext ? 'bg-accent/15 text-accent ring-accent/40' : 'text-white/80 ring-white/15 hover:ring-white/40'}`} aria-label="Lecture aléatoire">
            <Shuffle className="size-5" />
          </button>
          <div className="flex-1" />
          {tracks.length > 0 && (
            <button onClick={() => setEditing(true)} className="flex h-12 items-center gap-2 rounded-full px-4 text-sm font-bold text-white/85 ring-1 ring-white/15 transition hover:ring-white/40" aria-label="Modifier les titres">
              <ListChecks className="size-5" /> <span className="hidden sm:inline">Titres</span>
            </button>
          )}
          {!liked && (
            <button onClick={() => setEdit(true)} className="grid size-12 place-items-center rounded-full text-white/85 ring-1 ring-white/15 transition hover:ring-white/40" aria-label="Modifier la playlist">
              <Pencil className="size-5" />
            </button>
          )}
          {!liked && (
            <button onClick={() => setMenu(true)} className="grid size-12 place-items-center rounded-full text-white/80 ring-1 ring-white/15 transition hover:ring-white/40" aria-label="Options">
              <MoreVertical className="size-5" />
            </button>
          )}
        </div>
      )}

      <div className="relative px-2 md:px-3">
        {tracks.map((t, i) =>
          editing ? (
            <EditRow
              key={t.id}
              track={t}
              index={i}
              count={tracks.length}
              selected={selected.has(t.id)}
              onToggle={() => toggleSel(t.id)}
              onMove={liked ? undefined : (to) => moveTrack(id, i, to)}
              onRemove={() => removeMany([t.id])}
            />
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

      {!liked && !editing && (
        <div ref={addRef}>
          <AddTracks playlist={playlist!} />
        </div>
      )}

      {!liked && (
        <>
          <Sheet open={menu} onClose={() => setMenu(false)} title={<div className="flex items-center gap-3"><PlaylistCover playlist={playlist} className="size-12" rounded="rounded-xl" /><span className="truncate font-display text-lg font-bold">{name}</span></div>}>
            <div className="py-1">
              <SheetItem icon={<Pencil />} label="Nom, description et miniature" onClick={() => (setMenu(false), setEdit(true))} />
              {tracks.length > 0 && <SheetItem icon={<ListChecks />} label="Retirer ou réorganiser des titres" onClick={() => (setMenu(false), setEditing(true))} />}
              <SheetItem icon={<Trash2 />} label="Supprimer la playlist" danger onClick={() => (setMenu(false), setAskDelete(true))} />
            </div>
          </Sheet>
          <Sheet open={askDelete} onClose={() => setAskDelete(false)} title={<div className="font-display text-xl font-bold">Supprimer la playlist ?</div>}>
            <div className="px-5 pb-3">
              <p className="text-sm text-white/80">
                « {name} » et ses {plural(tracks.length, 'titre')} seront supprimés. Cette action est définitive.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setAskDelete(false)} className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold hover:bg-white/15">Annuler</button>
                <button
                  onClick={() => {
                    setAskDelete(false);
                    deletePlaylist(id);
                    toast('Playlist supprimée');
                    navigate('/library', { replace: true });
                  }}
                  className="rounded-full bg-red-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-400"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </Sheet>
          {edit && <EditSheet playlist={playlist!} open={edit} onClose={() => setEdit(false)} />}
        </>
      )}
    </div>
  );
}
