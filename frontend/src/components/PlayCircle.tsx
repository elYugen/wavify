import { Pause, Play } from 'lucide-react';

/** Bouton lecture signature : pastille dégradé coucher de soleil. */
export function PlayCircle({
  playing,
  onClick,
  className = 'size-14',
  icon = 'size-6',
  label,
}: {
  playing: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  icon?: string;
  label?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`bg-sunset grid shrink-0 grid-flow-col place-items-center gap-2 rounded-full font-bold text-on-accent shadow-[0_10px_30px_-6px_rgba(255,106,61,.6)] transition hover:brightness-110 active:scale-95 ${label ? 'h-12 px-6' : ''} ${className}`}
      aria-label={playing ? 'Pause' : 'Lecture'}
    >
      {playing ? <Pause className={`${icon} fill-current`} /> : <Play className={`${icon} translate-x-[1px] fill-current`} />}
      {label && <span>{playing ? 'Pause' : 'Lecture'}</span>}
    </button>
  );
}
