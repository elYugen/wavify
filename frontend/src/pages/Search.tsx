import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, Search as SearchIcon, X } from 'lucide-react';
import type { Source } from '../types';
import { useSearch } from '../lib/useSearch';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { GENRES } from '../lib/genres';
import { SOURCES } from '../lib/sources';
import { fmtTime } from '../lib/format';
import { TrackRow } from '../components/TrackRow';
import { SourceTabs } from '../components/SourceTabs';
import { RowSkeleton } from '../components/Skeleton';
import { Artwork } from '../components/Artwork';
import { PlayCircle } from '../components/PlayCircle';
import { SourceIcon } from '../components/SourceIcon';
import { MoodChip } from '../components/MoodChip';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const source = (params.get('src') as Source) || 'youtube';
  const { results, loading, error } = useSearch(source, q);
  const { searches, pushSearch, clearSearches } = useLibrary();
  const { playQueue, toggle } = usePlayer();
  const currentId = usePlayer((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const input = useRef<HTMLInputElement>(null);

  const update = (patch: Record<string, string>) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
      return n;
    }, { replace: true });

  useEffect(() => {
    if (results.length) pushSearch(q);
  }, [results, q, pushSearch]);

  const play = (i: number) => {
    if (results[i].id === currentId) toggle();
    else playQueue(results, i);
  };
  const top = results[0];

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 bg-base/85 px-4 pb-3 pt-[max(env(safe-area-inset-top),18px)] backdrop-blur-xl md:px-7 md:pt-6">
        <h1 className="mb-3 font-display text-[32px] font-extrabold leading-none tracking-tight md:hidden">
          Explorer<span className="text-sunset">.</span>
        </h1>
        <label className="group flex items-center gap-3 rounded-2xl bg-white/[.07] px-4 py-3.5 ring-1 ring-white/[.08] transition focus-within:bg-white/[.1] focus-within:ring-2 focus-within:ring-accent/70 md:max-w-lg">
          <SearchIcon className="size-5 shrink-0 text-muted transition group-focus-within:text-accent" />
          <input
            ref={input}
            value={q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Un titre, un artiste, une vibe…"
            className="w-full bg-transparent text-[15px] font-semibold outline-none placeholder:font-medium placeholder:text-muted"
            enterKeyHint="search"
            onKeyDown={(e) => e.key === 'Enter' && input.current?.blur()}
          />
          {q && (
            <button onClick={() => update({ q: '' })} className="grid size-6 place-items-center rounded-full bg-white/10" aria-label="Effacer">
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <SourceTabs value={source} onChange={(s) => update({ src: s === 'youtube' ? '' : s })} className="mt-3" />
      </div>

      {!q.trim() && (
        <div className="px-4 pt-2 md:px-7">
          {searches.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Tes dernières recherches</h2>
                <button onClick={clearSearches} className="text-sm font-semibold text-muted hover:text-white">Effacer</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searches.map((s) => (
                  <button key={s} onClick={() => update({ q: s })} className="flex items-center gap-2 rounded-xl bg-white/[.05] px-3 py-2 text-sm font-medium ring-1 ring-white/[.06] hover:bg-white/10">
                    <History className="size-3.5 text-muted" /> {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <h2 className="mb-3 font-display text-lg font-bold">Selon ton humeur</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {GENRES.map((g) => (
              <MoodChip key={g.label} big g={g} to={`/search?q=${encodeURIComponent(g.q)}${source !== 'youtube' ? `&src=${source}` : ''}`} />
            ))}
          </div>
        </div>
      )}

      {q.trim() && (
        <div className="md:px-4">
          {loading && <RowSkeleton count={8} />}
          {!loading && error && (
            <div className="mx-4 mt-6 rounded-3xl bg-white/[.04] px-4 py-10 text-center">
              <p className="font-display text-lg font-bold">{SOURCES[source].label} ne répond pas</p>
              <p className="mt-1 text-sm text-muted">{error}</p>
              <p className="mt-3 text-sm text-muted">Essaie une autre source juste au-dessus.</p>
            </div>
          )}
          {!loading && !error && results.length === 0 && q.trim().length >= 2 && (
            <p className="px-4 py-10 text-center text-muted">Rien trouvé pour « {q} » sur {SOURCES[source].label}.</p>
          )}
          {!loading && top && (
            <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
              <div className="hidden px-3 lg:block">
                <div onClick={() => play(0)} className="group relative cursor-pointer overflow-hidden rounded-[28px] p-6 ring-1 ring-white/[.08]">
                  {top.artwork && <img src={top.artwork} alt="" className="absolute inset-0 size-full scale-150 object-cover opacity-40 blur-2xl" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-ink/30" />
                  <div className="relative">
                    <p className="text-[11px] font-bold uppercase tracking-[.2em] text-accent-2">Meilleur résultat</p>
                    <Artwork track={top} className="mt-4 size-28 shadow-2xl" rounded="rounded-2xl" />
                    <div className="mt-4 line-clamp-2 font-display text-2xl font-extrabold leading-tight">{top.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-white/70">
                      <SourceIcon source={top.source} />
                      {top.artist} · {fmtTime(top.duration)}
                    </div>
                  </div>
                  <PlayCircle playing={currentId === top.id && isPlaying} onClick={() => play(0)} className="absolute bottom-6 right-6 size-14" />
                </div>
              </div>
              <div className="px-2 md:px-0">
                {results.map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} onPlay={() => play(i)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
