import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import type { Playlist, SharedPlaylist } from '../types';
import { fetchShared } from '../lib/api';
import { fmtTotal, plural } from '../lib/format';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { toast } from '../store/toast';
import { PlaylistCover } from '../components/PlaylistCover';
import { PlayCircle } from '../components/PlayCircle';
import { StickyBar } from '../components/PageHeader';
import { TrackRow } from '../components/TrackRow';
import { RowSkeleton } from '../components/Skeleton';
import { Avatar } from '../components/Avatar';

/** Playlist ouverte depuis un lien de partage (/s/:token) : écoute et ajout à sa collection. */
export default function Shared() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SharedPlaylist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contextId = `shared:${token}`;
  const isContext = usePlayer((s) => s.contextId === contextId);
  const isPlaying = usePlayer((s) => s.isPlaying && s.contextId === contextId);
  const { playQueue, toggle } = usePlayer();
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const copy = useLibrary((s) => s.playlists.find((p) => p.importedFrom === `share:${token}`));

  useEffect(() => {
    fetchShared(token)
      .then(setData)
      .catch((e) => setError(e.status === 404 ? "Ce lien ne fonctionne plus : la playlist n'est plus partagée." : e.message));
  }, [token]);

  // Forme Playlist pour réutiliser la pochette.
  const asPlaylist = useMemo<Playlist | undefined>(
    () => data ? { id: contextId, name: data.name, description: data.description, tracks: data.tracks, cover: data.cover, createdAt: 0, updatedAt: data.updatedAt } : undefined,
    [data, contextId],
  );
  const total = useMemo(() => (data?.tracks || []).reduce((a, t) => a + (t.duration || 0), 0), [data]);

  if (error)
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="text-xl font-bold">Playlist introuvable</p>
          <p className="mt-2 text-muted">{error}</p>
          <button onClick={() => navigate('/')} className="bg-sunset mt-4 rounded-full px-5 py-2 font-bold text-on-accent">Accueil</button>
        </div>
      </div>
    );

  if (!data || !asPlaylist)
    return (
      <div className="pt-24">
        <RowSkeleton count={8} />
      </div>
    );

  const add = () => {
    const id = createPlaylist(data.name, { description: data.description, tracks: data.tracks, cover: data.cover, importedFrom: `share:${token}` });
    toast('Ajoutée à ta collection');
    navigate(`/playlist/${id}`);
  };
  const backdrop = data.cover || data.tracks.find((t) => t.artwork)?.artwork || '';

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        {backdrop ? <img src={backdrop} alt="" className="size-full scale-125 object-cover opacity-45 blur-3xl saturate-150" /> : <div className="bg-sunset size-full opacity-25 blur-3xl" />}
        <div className="absolute inset-0 bg-gradient-to-b from-base/10 via-base/70 to-base" />
      </div>
      <StickyBar title={data.name} />

      <header className="relative flex flex-col items-center gap-6 px-4 pb-4 pt-2 md:flex-row md:items-end md:px-7 md:pt-4">
        <PlaylistCover playlist={asPlaylist} rounded="rounded-3xl" className="size-[200px] shrink-0 shadow-[0_24px_60px_rgba(0,0,0,.55)] md:size-[220px]" />
        <div className="w-full min-w-0 text-center md:text-left">
          <Link to={`/u/${data.ownerHandle}`} className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-accent-2 hover:text-white">
            <Avatar user={{ name: data.owner, handle: data.ownerHandle, avatar: data.ownerAvatar }} className="size-6" text="text-xs" />
            Partagée par {data.owner}
          </Link>
          <h1 className="mt-1 line-clamp-2 font-display text-[34px] font-extrabold leading-[1.02] tracking-tight md:text-[clamp(2.75rem,5.5vw,4.75rem)]">{data.name}</h1>
          {data.description && <p className="mt-2 text-sm text-white/70">{data.description}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
            <span className="rounded-full bg-white/[.08] px-3 py-1 text-xs font-bold">{plural(data.tracks.length, 'titre')}</span>
            {total > 0 && <span className="rounded-full bg-white/[.08] px-3 py-1 text-xs font-bold">{fmtTotal(total)}</span>}
          </div>
        </div>
      </header>

      <div className="relative flex items-center gap-2 px-4 py-4 md:px-7">
        {data.tracks.length > 0 && <PlayCircle playing={isPlaying} onClick={() => (isContext ? toggle() : playQueue(data.tracks, 0, contextId))} label className="text-[15px]" icon="size-5" />}
        {copy ? (
          <Link to={`/playlist/${copy.id}`} className="flex h-12 items-center gap-2 rounded-full px-4 text-sm font-bold text-emerald-300 ring-1 ring-emerald-300/30">
            <Check className="size-5" /> Dans ta collection
          </Link>
        ) : (
          <button onClick={add} className="flex h-12 items-center gap-2 rounded-full px-4 text-sm font-bold text-white/85 ring-1 ring-white/15 transition hover:ring-white/40">
            <Plus className="size-5" /> Ajouter à ma collection
          </button>
        )}
      </div>

      <div className="relative px-2 md:px-3">
        {data.tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} showIndex onPlay={() => playQueue(data.tracks, i, contextId)} />
        ))}
        {!data.tracks.length && <p className="px-4 py-16 text-center text-muted">Cette playlist est vide pour l'instant.</p>}
      </div>
    </div>
  );
}
