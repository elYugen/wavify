import { ExternalLink, FileUp, Lightbulb } from 'lucide-react';
import { Sheet } from './Sheet';

const STEPS = [
  <>
    Ouvre{' '}
    <a href="https://exportify.net" target="_blank" rel="noopener" className="font-bold text-accent-2 underline">
      exportify.net
    </a>{' '}
    (plus simple sur ordinateur, mais ça marche aussi sur téléphone) et clique sur <b>Get Started</b>.
  </>,
  <>
    Connecte-toi avec ton compte Spotify et accepte l'accès <b>en lecture</b> à tes playlists.
  </>,
  <>
    La liste de tes playlists s'affiche. Clique sur <b>Export</b> à côté de celle que tu veux : un fichier <b>.csv</b> est téléchargé.
  </>,
  <>
    Reviens ici, touche <b>Importer un fichier CSV</b> et choisis le fichier (sur téléphone : app Fichiers › Téléchargements).
  </>,
  <>Choisis la source (YouTube recommandé) puis lance l'import, comme avec un lien. Il n'y a pas de limite de titres.</>,
];

/** Tuto : exporter une playlist Spotify en CSV avec Exportify puis l'importer. */
export function CsvGuide({ open, onClose, onPickFile }: { open: boolean; onClose: () => void; onPickFile: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <div>
          <div className="text-xs font-bold uppercase tracking-[.18em] text-accent-2">Tuto</div>
          <div className="mt-1 font-display text-xl font-bold">Importer une playlist en CSV</div>
          <p className="mt-1 text-sm text-muted">La solution pour les grosses playlists et celles des autres, sans limite de 100 titres.</p>
        </div>
      }
    >
      <ol className="space-y-2 px-5">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-white/[.04] p-3.5 text-sm text-white/85 ring-1 ring-white/[.06]">
            <span className="text-sunset font-display text-2xl font-extrabold leading-none">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mx-5 mt-3 flex gap-3 rounded-2xl bg-accent-2/10 p-3.5 text-sm text-white/85 ring-1 ring-accent-2/25">
        <Lightbulb className="mt-0.5 size-5 shrink-0 text-accent-2" />
        <div className="space-y-1.5">
          <p>
            Exportify ne voit que les playlists de <b>ta bibliothèque</b>. Pour celle d'un autre utilisateur, ajoute-la d'abord dans Spotify (bouton <b>⊕</b> ou « Ajouter à la bibliothèque »).
          </p>
          <p>
            <b>Export All</b> télécharge un .zip : décompresse-le, puis importe les fichiers un par un.
          </p>
          <p>Tout CSV avec une colonne titre et une colonne artiste fonctionne aussi (Excel, Google Sheets…).</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-2 pt-4">
        <a href="https://exportify.net" target="_blank" rel="noopener" className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-bold hover:bg-white/15">
          <ExternalLink className="size-4" /> Ouvrir Exportify
        </a>
        <button
          onClick={() => {
            onClose();
            onPickFile();
          }}
          className="bg-sunset flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-on-accent transition active:scale-95"
        >
          <FileUp className="size-4" /> Choisir mon fichier
        </button>
      </div>
    </Sheet>
  );
}
