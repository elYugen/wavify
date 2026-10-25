import type { Track } from '../types';
import { Artwork } from './Artwork';

/** Disque vinyle dont l'étiquette est la pochette ; tourne pendant la lecture. */
export function Vinyl({ track, spinning, className = '' }: { track: Track | null; spinning: boolean; className?: string }) {
  return (
    <div className={`vinyl aspect-square rounded-full ${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} ${className}`}>
      <div className={`absolute inset-0 rounded-full ${spinning ? 'spin-slow' : 'spin-slow [animation-play-state:paused]'}`}>
        <div className="absolute inset-[31%] overflow-hidden rounded-full ring-4 ring-black/40">
          <Artwork track={track} rounded="rounded-full" className="size-full" />
        </div>
        <div className="absolute left-1/2 top-1/2 size-[4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-white/10" />
      </div>
    </div>
  );
}
