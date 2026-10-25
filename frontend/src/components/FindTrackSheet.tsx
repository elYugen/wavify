import { useEffect, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import type { Source, Track } from '../types';
import { useSearch } from '../lib/useSearch';
import { usePlayer } from '../store/player';
import { Sheet } from './Sheet';
import { SourceTabs } from './SourceTabs';
import { TrackRow } from './TrackRow';
import { RowSkeleton } from './Skeleton';

interface Target {
  title: string;
  artist: string;
}

/** Recherche manuelle d'un titre introuvable à l'import : toucher un résultat l'écoute, « + » l'ajoute. */
export function FindTrackSheet({ target, onPick, onClose }: { target: Target | null; onPick: (t: Track) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<Source>('youtube');
  const playQueue = usePlayer((s) => s.playQueue);
  const { results, loading, error } = useSearch(source, target ? query : '');

  useEffect(() => {
    if (target) {
      setQuery(`${target.artist.split(',')[0]} ${target.title}`.trim());
      setSource('youtube');
    }
  }, [target]);

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={
        <div>
          <div className="text-xs font-bold uppercase tracking-[.18em] text-accent-2">Titre introuvable</div>
          <div className="mt-1 truncate font-display text-xl font-bold">{target?.title}</div>
          <div className="truncate text-sm text-muted">{target?.artist}</div>
          <label className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[.06] px-4 py-3 ring-accent/60 focus-within:ring-2">
            <SearchIcon className="size-5 shrink-0 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" placeholder="Artiste et titre" />
          </label>
          <SourceTabs value={source} onChange={setSource} className="mt-3" />
        </div>
      }
    >
      <div className="min-h-[40dvh] px-2 pb-3">
        {loading && <RowSkeleton count={5} />}
        {!loading && error && <p className="px-3 py-6 text-center text-sm text-red-300">{error}</p>}
        {!loading && !error && query.trim().length >= 2 && !results.length && (
          <p className="px-3 py-6 text-center text-sm text-muted">Aucun résultat. Essaie une autre orthographe ou une autre source.</p>
        )}
        {!loading &&
          results.map((t, i) => <TrackRow key={t.id} track={t} onPlay={() => playQueue(results, i)} action="add" onAction={() => onPick(t)} />)}
      </div>
    </Sheet>
  );
}
