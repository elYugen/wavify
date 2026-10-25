import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CircleAlert, ClipboardPaste, FileUp, Info, LoaderCircle, RotateCw, Search as SearchIcon, WifiOff, X } from 'lucide-react';
import type { Source, SpotifyImport, Track } from '../types';
import { HttpError, fetchSpotify, spotifyApiEnabled } from '../lib/api';
import { csvToImport } from '../lib/csv';
import { matchTrack, pool } from '../lib/match';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { toast } from '../store/toast';
import { plural } from '../lib/format';
import { SOURCES } from '../lib/sources';
import { SourceTabs } from '../components/SourceTabs';
import { Artwork } from '../components/Artwork';

type Status = 'pending' | 'searching' | 'found' | 'missing' | 'error';

const LIST_MAX = 150; // au-delà, on n'affiche que les titres à problème
const JOB_KEY = 'wavify-import-job';

interface SavedJob {
  data: SpotifyImport;
  url: string;
  source: Source;
  id: string;
  found: (Track | null)[];
  st: Status[];
}

/** L'import en cours est sauvegardé pour survivre à un rechargement ou à la fermeture de l'app. */
const saveJob = (j: SavedJob | null) => {
  try {
    if (j) localStorage.setItem(JOB_KEY, JSON.stringify(j));
    else localStorage.removeItem(JOB_KEY);
  } catch {
    /* stockage plein ou indisponible */
  }
};
const loadJob = (): SavedJob | null => {
  try {
    return JSON.parse(localStorage.getItem(JOB_KEY) || 'null');
  } catch {
    return null;
  }
};

export default function Import() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<SpotifyImport | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>('youtube');
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [matches, setMatches] = useState<(Track | null)[]>([]);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const [paused, setPaused] = useState<string | null>(null);
  // État de l'import conservé entre une pause et une reprise
  const job = useRef<{ id: string; found: (Track | null)[]; st: Status[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [apiOn, setApiOn] = useState<boolean | null>(null);
  useEffect(() => {
    spotifyApiEnabled().then(setApiOn);
    // Reprise d'un import interrompu (rechargement, app fermée, serveur coupé…)
    const saved = loadJob();
    if (!saved || !useLibrary.getState().playlists.some((p) => p.id === saved.id)) return saveJob(null);
    const st = saved.st.map((s) => (s === 'searching' ? 'error' : s));
    job.current = { id: saved.id, found: saved.found, st };
    setData(saved.data);
    setUrl(saved.url);
    setSource(saved.source);
    setStatuses(st);
    setMatches(saved.found);
    setPlaylistId(saved.id);
    const left = st.filter((s) => s === 'pending' || s === 'error').length;
    setPaused(`Import interrompu : il reste ${plural(left, 'titre')} à chercher. Tu peux reprendre là où tu t'étais arrêté.`);
  }, []);
  // Quitter la page met l'import en pause (il reste sauvegardé et reprenable)
  useEffect(() => () => abort.current?.abort(), []);

  const load = (d: SpotifyImport) => {
    if (!d.tracks.length) throw new Error('Cette playlist est vide');
    setData(d);
    setPaused(null);
    job.current = null;
    saveJob(null);
    setStatuses(d.tracks.map(() => 'pending'));
    setMatches(d.tracks.map(() => null));
  };

  const onCsv = async (file?: File) => {
    if (!file) return;
    setError(null);
    setPlaylistId(null);
    try {
      load(csvToImport(await file.text(), file.name));
    } catch (e: any) {
      setData(null);
      setError(e.message);
    }
  };
  const { createPlaylist, updatePlaylist } = useLibrary();
  const playQueue = usePlayer((s) => s.playQueue);

  const analyse = async (value = url) => {
    if (!value.trim()) return;
    setFetching(true);
    setError(null);
    setData(null);
    setPlaylistId(null);
    try {
      load(await fetchSpotify(value.trim()));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFetching(false);
    }
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setUrl(t);
      analyse(t);
    } catch {
      toast('Colle le lien manuellement');
    }
  };

  const run = async () => {
    if (!data) return;
    const ctrl = (abort.current = new AbortController());
    setRunning(true);
    setPaused(null);
    if (!job.current) {
      const id = createPlaylist(data.name, {
        description: `Importée de Spotify${data.owner ? ` · ${data.owner}` : ''}`,
        importedFrom: data.via === 'csv' ? `csv:${data.id}` : url,
      });
      job.current = { id, found: data.tracks.map(() => null), st: data.tracks.map(() => 'pending') };
      setPlaylistId(id);
    }
    const { id, found, st } = job.current;
    // Reprise : on ne retraite que les titres en attente ou en erreur
    const todo = data.tracks.map((t, i) => ({ t, i })).filter(({ i }) => st[i] === 'pending' || st[i] === 'error' || st[i] === 'searching');
    todo.forEach(({ i }) => (st[i] = 'pending'));
    const flush = () => {
      setStatuses([...st]);
      setMatches([...found]);
      const seen = new Set<string>();
      updatePlaylist(id, { tracks: found.filter((t): t is Track => !!t && !seen.has(t.id) && !!seen.add(t.id)) });
      saveJob({ data, url, source, id, found, st });
    };
    let done = 0;
    let offline = 0;
    let lastError = '';
    await pool(
      todo,
      4,
      async ({ t, i }) => {
        st[i] = 'searching';
        setStatuses([...st]);
        try {
          found[i] = await matchTrack(source, t);
          st[i] = found[i] ? 'found' : 'missing';
          offline = 0;
        } catch (e) {
          st[i] = 'error';
          lastError = e instanceof Error ? e.message : 'Erreur inconnue';
          // Serveur injoignable plusieurs fois d'affilée : on met l'import en pause
          if (e instanceof HttpError && e.status === 0 && ++offline >= 3 && !ctrl.signal.aborted) {
            ctrl.abort();
            setPaused('Le serveur Wavify ne répond plus. Vérifie que « npm run dev » tourne toujours, puis reprends.');
          }
        }
        if (++done % (todo.length > 200 ? 15 : 4) === 0 || done === todo.length) flush();
        else setStatuses([...st]);
      },
      ctrl.signal,
    );
    st.forEach((s, i) => s === 'searching' && (st[i] = 'error'));
    flush();
    setRunning(false);
    const n = found.filter(Boolean).length;
    const errors = st.filter((s) => s === 'error').length;
    if (ctrl.signal.aborted) {
      setPaused((p) => p || `Import en pause : ${n} titres ajoutés, ${st.filter((s) => s === 'pending' || s === 'error').length} restants.`);
      toast('Import en pause');
    } else if (errors) {
      setPaused(`${plural(errors, 'titre')} en erreur (${lastError}). Tu peux les réessayer.`);
      toast(`${n}/${data.tracks.length} titres importés`);
    } else {
      saveJob(null); // terminé sans erreur : plus rien à reprendre
      toast(`${n}/${data.tracks.length} titres importés`);
    }
  };

  const foundCount = statuses.filter((s) => s === 'found').length;
  const doneCount = statuses.filter((s) => s === 'found' || s === 'missing').length;
  const progress = data ? (doneCount / data.tracks.length) * 100 : 0;
  const finished = !!playlistId && !running && !paused;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden">
        <div className="absolute -left-20 -top-32 size-96 rounded-full bg-[#1db954] opacity-[.14] blur-3xl" />
        <div className="bg-sunset absolute -right-24 -top-24 size-80 rounded-full opacity-[.16] blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-[max(env(safe-area-inset-top),20px)] md:px-6 md:pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[.22em] text-accent-2">Déménagement</p>
        <h1 className="mt-1 font-display text-[34px] font-extrabold leading-[1.02] tracking-tight md:text-5xl">
          Ramène tes playlists Spotify<span className="text-sunset">.</span>
        </h1>
        <p className="mt-2 max-w-xl text-white/75">
          Colle le lien d'une playlist ou d'un album <b>public</b>. Wavify retrouve chaque titre sur la source de ton choix et crée la playlist pour toi.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            analyse();
          }}
          className="mt-6 flex gap-2"
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/…"
            className="min-w-0 flex-1 rounded-2xl bg-white/[.07] px-4 py-3.5 text-[15px] font-semibold outline-none ring-1 ring-white/[.08] placeholder:font-medium placeholder:text-muted focus:ring-2 focus:ring-accent/70"
            inputMode="url"
          />
          {!url && 'clipboard' in navigator && (
            <button type="button" onClick={paste} className="grid size-[52px] shrink-0 place-items-center rounded-2xl bg-white/[.07] transition hover:bg-white/15" aria-label="Coller">
              <ClipboardPaste className="size-5" />
            </button>
          )}
          <button disabled={fetching || !url} className="bg-sunset flex shrink-0 items-center gap-2 rounded-2xl px-5 font-bold text-on-accent transition enabled:hover:brightness-110 disabled:opacity-40">
            {fetching ? <LoaderCircle className="size-5 animate-spin" /> : 'Analyser'}
          </button>
        </form>
        {error && (
          <p className="mt-3 flex items-center gap-2 text-sm text-red-300">
            <CircleAlert className="size-4" /> {error}
          </p>
        )}

        <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => (onCsv(e.target.files?.[0]), (e.target.value = ''))} />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <button onClick={() => fileInput.current?.click()} className="flex items-center gap-2 font-bold text-white/85 hover:text-white">
            <FileUp className="size-4 text-accent-2" /> Importer un fichier CSV
          </button>
          {apiOn !== null && (
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${apiOn ? 'text-emerald-300' : 'text-muted'}`}>
              <span className={`size-1.5 rounded-full ${apiOn ? 'bg-emerald-400' : 'bg-white/30'}`} />
              {apiOn ? 'API Spotify active : pas de limite' : 'Mode sans clé : 100 titres max par lien'}
            </span>
          )}
        </div>

        {!data && !error && (
          <ol className="mt-8 grid gap-3 text-sm text-white/75 md:grid-cols-3">
            {[
              'Dans Spotify, ouvre ta playlist puis ⋯ › Partager › Copier le lien.',
              'Colle le lien ici et appuie sur Analyser.',
              'Choisis la source (YouTube recommandé) puis lance l’import.',
            ].map((s, i) => (
              <li key={i} className="flex gap-3 rounded-3xl bg-white/[.04] p-4 ring-1 ring-white/[.06] md:flex-col">
                <span className="text-sunset font-display text-3xl font-extrabold leading-none">0{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        )}

        {data && (
          <div className="mt-8">
            <div className="flex items-center gap-4 rounded-[28px] bg-white/[.05] p-4 ring-1 ring-white/[.07]">
              {data.cover ? <img src={data.cover} alt="" className="size-24 rounded-2xl object-cover shadow-xl" /> : <div className="bg-sunset grid size-24 shrink-0 place-items-center rounded-2xl text-on-accent"><FileUp className="size-9" /></div>}
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-white/60">{data.via === 'csv' ? 'Fichier CSV' : `${data.kind === 'album' ? 'Album' : 'Playlist'} Spotify`}</div>
                <div className="truncate font-display text-xl font-extrabold">{data.name}</div>
                <div className="text-sm text-white/70">
                  {data.owner && `${data.owner} · `}
                  {plural(data.tracks.length, 'titre')}
                </div>
              </div>
            </div>

            {(data.limited || data.apiError) && !playlistId && (
              <div className="mt-4 flex gap-3 rounded-3xl bg-accent-2/10 p-4 text-sm ring-1 ring-accent-2/25">
                <Info className="mt-0.5 size-5 shrink-0 text-accent-2" />
                <div className="text-white/85">
                  <p className="font-bold text-white">Seuls les 100 premiers titres sont visibles sans clé.</p>
                  <p className="mt-1">Pour tout récupérer, au choix :</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    <li>
                      exporte la playlist en CSV sur{' '}
                      <a href="https://exportify.net" target="_blank" rel="noopener" className="font-bold text-accent-2 underline">Exportify</a>, puis{' '}
                      <button onClick={() => fileInput.current?.click()} className="font-bold text-accent-2 underline">importe le fichier</button> ;
                    </li>
                    <li>ou ajoute tes clés Spotify gratuites dans le fichier .env (voir le README).</li>
                  </ul>
                  {data.apiError && <p className="mt-2 text-xs text-white/60">API Spotify : {data.apiError}</p>}
                </div>
              </div>
            )}

            {!playlistId && (
              <div className="mt-6">
                <div className="mb-2 text-sm font-semibold text-white/80">Chercher les titres sur</div>
                <SourceTabs value={source} onChange={setSource} />
                <p className="mt-2 text-xs text-muted">
                  {SOURCES[source].hint}. YouTube trouve presque tout ; Audius a un catalogue plus restreint.
                  {data.tracks.length > 150 && ` Compte environ ${Math.ceil((data.tracks.length * 0.35) / 60)} min pour ${data.tracks.length} titres.`}
                </p>
                <button onClick={run} className="bg-sunset mt-5 w-full rounded-full py-3.5 text-base font-bold text-on-accent shadow-[0_10px_30px_-8px_rgba(255,106,61,.7)] transition hover:brightness-110 active:scale-[.98] md:w-auto md:px-10">
                  Importer {plural(data.tracks.length, 'titre')}
                </button>
              </div>
            )}

            {playlistId && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    {running ? 'Recherche des titres…' : paused ? 'Import en pause' : 'Import terminé'} · {foundCount}/{data.tracks.length} trouvés
                  </span>
                  {running && (
                    <button onClick={() => abort.current?.abort()} className="flex items-center gap-1 text-muted hover:text-white">
                      <X className="size-4" /> Pause
                    </button>
                  )}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="bg-sunset h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                {paused && !running && (
                  <div className="mt-4 rounded-3xl bg-red-500/10 p-4 ring-1 ring-red-400/25">
                    <p className="flex items-start gap-2 text-sm text-white/90">
                      <WifiOff className="mt-0.5 size-4 shrink-0 text-red-300" /> {paused}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={run} className="bg-sunset flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-on-accent transition active:scale-95">
                        <RotateCw className="size-4" /> Reprendre l'import
                      </button>
                      <Link to={`/playlist/${playlistId}`} className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold hover:bg-white/15">
                        Voir la playlist
                      </Link>
                    </div>
                  </div>
                )}
                {finished && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to={`/playlist/${playlistId}`} className="rounded-full bg-white px-6 py-3 font-bold text-ink transition hover:scale-[1.03]">
                      Ouvrir la playlist
                    </Link>
                    {foundCount > 0 && (
                      <button
                        onClick={() => playQueue(matches.filter((m): m is Track => !!m), 0, playlistId)}
                        className="bg-sunset rounded-full px-6 py-3 font-bold text-on-accent transition hover:scale-[1.03]"
                      >
                        Écouter
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 divide-y divide-white/[.04] rounded-[28px] bg-white/[.02] px-3 ring-1 ring-white/[.05]">
              {data.tracks.length > LIST_MAX && (
                <p className="py-3 text-center text-xs text-muted">
                  {playlistId ? 'Seuls les titres en cours ou introuvables sont listés.' : `Aperçu des ${LIST_MAX} premiers titres sur ${data.tracks.length}.`}
                </p>
              )}
              {data.tracks.map((t, i) => {
                const s = statuses[i];
                if (data.tracks.length > LIST_MAX) {
                  if (playlistId ? s !== 'missing' && s !== 'searching' && s !== 'error' : i >= LIST_MAX) return null;
                }
                const m = matches[i];
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <span className="w-6 text-right text-sm tabular-nums text-muted">{i + 1}</span>
                    {m ? <Artwork track={m} className="size-10 shrink-0" /> : <div className="size-10 shrink-0 rounded-xl bg-white/[.06]" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="truncate text-xs text-muted">{m && s === 'found' ? `→ ${m.title}` : t.artist}</div>
                    </div>
                    {s === 'searching' && <LoaderCircle className="size-5 animate-spin text-muted" />}
                    {s === 'found' && <Check className="size-5 text-accent-2" />}
                    {s === 'error' && <span title="Erreur réseau, sera réessayé"><RotateCw className="size-4 text-red-300" /></span>}
                    {s === 'missing' && (
                      <Link to={`/search?q=${encodeURIComponent(`${t.artist.split(',')[0]} ${t.title}`)}`} className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20">
                        <SearchIcon className="size-3.5" /> Chercher
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
