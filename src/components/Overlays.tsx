import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ExternalLink, Heart, ListEnd, ListPlus, ListStart, Plus, Search, Trash2 } from 'lucide-react';
import { useUi } from '../store/ui';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { toast, useToast } from '../store/toast';
import { plural } from '../lib/format';
import { Sheet, SheetItem } from './Sheet';
import { Artwork } from './Artwork';
import { PlaylistCover } from './PlaylistCover';
import { SourceIcon } from './SourceIcon';
import { SOURCES } from '../lib/sources';

function TrackMenu() {
  const menu = useUi((s) => s.menu);
  const { close, openAddTo } = useUi();
  const liked = useLibrary((s) => !!menu && s.liked.some((t) => t.id === menu.track.id));
  const { toggleLike, removeTrack } = useLibrary();
  const { addToQueue, playNext } = usePlayer();
  const t = menu?.track;
  return (
    <Sheet
      open={!!menu}
      onClose={close}
      title={
        t && (
          <div className="flex items-center gap-3">
            <Artwork track={t} className="size-14" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{t.title}</div>
              <div className="truncate text-sm text-muted">{t.artist}</div>
            </div>
          </div>
        )
      }
    >
      {t && (
        <div className="py-1">
          <SheetItem icon={<ListPlus />} label="Ajouter à une playlist" onClick={() => openAddTo([t])} />
          <SheetItem
            icon={<Heart className={liked ? 'fill-accent text-accent' : ''} />}
            label={liked ? 'Retirer de mes coups de cœur' : 'Ajouter à mes coups de cœur'}
            onClick={() => {
              toast(toggleLike(t) ? 'Ajouté à tes coups de cœur' : 'Retiré de tes coups de cœur');
              close();
            }}
          />
          <SheetItem icon={<ListStart />} label="Lire ensuite" onClick={() => (playNext(t), close())} />
          <SheetItem icon={<ListEnd />} label="Ajouter à la file d'attente" onClick={() => (addToQueue(t), close())} />
          {menu?.playlistId && (
            <SheetItem
              icon={<Trash2 />}
              label="Retirer de cette playlist"
              danger
              onClick={() => {
                removeTrack(menu.playlistId!, t.id);
                toast('Retiré de la playlist');
                close();
              }}
            />
          )}
          <SheetItem
            icon={<ExternalLink />}
            label={`Ouvrir sur ${SOURCES[t.source].label}`}
            onClick={() => (window.open(t.url, '_blank', 'noopener'), close())}
          />
        </div>
      )}
    </Sheet>
  );
}

function AddToPlaylist() {
  const tracks = useUi((s) => s.addTo);
  const { close, openCreate } = useUi();
  const playlists = useLibrary((s) => s.playlists);
  const addTracks = useLibrary((s) => s.addTracks);
  const [filter, setFilter] = useState('');
  useEffect(() => setFilter(''), [tracks]);
  const list = playlists.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <Sheet open={!!tracks} onClose={close} title={<div className="font-display text-xl font-bold">Ajouter à…</div>}>
      <div className="px-5 pt-4">
        <button
          onClick={() => openCreate(tracks || [])}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/20 px-3 py-3 font-bold transition hover:border-accent hover:bg-accent/5"
        >
          <span className="bg-sunset grid size-12 place-items-center rounded-xl text-on-accent"><Plus className="size-6" /></span>
          Nouvelle playlist
        </button>
        {playlists.length > 4 && (
          <label className="mt-4 flex items-center gap-2 rounded-2xl bg-white/[.06] px-3 py-2.5">
            <Search className="size-4 text-muted" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Trouver une playlist" className="w-full bg-transparent text-sm outline-none placeholder:text-muted" />
          </label>
        )}
      </div>
      <div className="py-3">
        {list.map((p) => {
          const already = tracks?.length === 1 && p.tracks.some((t) => t.id === tracks[0].id);
          return (
            <button
              key={p.id}
              onClick={() => {
                const n = addTracks(p.id, tracks || []);
                toast(n ? `Ajouté à « ${p.name} »` : 'Déjà dans cette playlist');
                close();
              }}
              className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-white/[.06]"
            >
              <PlaylistCover playlist={p} className="size-12" rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-sm text-muted">{plural(p.tracks.length, 'titre')}</div>
              </div>
              {already && <Check className="size-5 text-accent-2" />}
            </button>
          );
        })}
        {!playlists.length && <p className="px-5 py-6 text-center text-sm text-muted">Tu n'as pas encore de playlist.</p>}
      </div>
    </Sheet>
  );
}

function CreatePlaylist() {
  const { createOpen, createWith, close } = useUi();
  const create = useLibrary((s) => s.createPlaylist);
  const count = useLibrary((s) => s.playlists.length);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (createOpen) {
      setName('');
      setDesc('');
      setTimeout(() => input.current?.focus(), 50);
    }
  }, [createOpen]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = create(name, { description: desc, tracks: createWith });
    toast(createWith.length ? `Playlist créée avec ${plural(createWith.length, 'titre')}` : 'Playlist créée');
    close();
    navigate(`/playlist/${id}`);
  };
  return (
    <Sheet open={createOpen} onClose={close} title={<div className="font-display text-xl font-bold">Nouvelle playlist</div>}>
      <form onSubmit={submit} className="space-y-4 px-5 py-5">
        <input
          ref={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Ma playlist n°${count + 1}`}
          className="w-full rounded-2xl bg-white/[.06] px-4 py-3.5 font-display text-2xl font-bold outline-none ring-accent/60 transition placeholder:text-white/25 focus:ring-2"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Ajoute une description (facultatif)"
          rows={2}
          className="w-full resize-none rounded-2xl bg-white/[.06] px-4 py-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/60"
        />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={close} className="rounded-full px-6 py-3 font-bold text-muted hover:text-white">
            Annuler
          </button>
          <button type="submit" className="bg-sunset flex items-center gap-2 rounded-full px-7 py-3 font-bold text-on-accent transition hover:brightness-110 active:scale-95">
            <Plus className="size-5" /> Créer
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function Toast() {
  const { message, key } = useToast();
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+170px)] z-[90] flex justify-center px-4 md:bottom-28">
      <div key={key} className="animate-toast glass flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-2xl">
        <span className="bg-sunset size-2 rounded-full" />
        {message}
      </div>
    </div>
  );
}

export function Overlays() {
  return (
    <>
      <TrackMenu />
      <AddToPlaylist />
      <CreatePlaylist />
      <Toast />
    </>
  );
}

export { SourceIcon };
