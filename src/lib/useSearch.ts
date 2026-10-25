import { useEffect, useState } from 'react';
import type { Source, Track } from '../types';
import { searchTracks } from './api';

/** Recherche avec anti-rebond et annulation des requêtes obsolètes. */
export function useSearch(source: Source, query: string, delay = 400) {
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    setError(null);
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchTracks(source, q, ctrl.signal)
        .then((r) => setResults(r))
        .catch((e) => {
          if (e.name !== 'AbortError') {
            setError(e.message);
            setResults([]);
          }
        })
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, delay);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [source, query, delay]);

  return { results, loading, error };
}
