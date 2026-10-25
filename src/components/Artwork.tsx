import { Music } from 'lucide-react';
import { useState } from 'react';
import type { Track } from '../types';
import { hue } from '../lib/format';

/** Pochette carrée ; recadre les vignettes YouTube (bandes noires 4:3). */
export function Artwork({ track, className = '', rounded = 'rounded-xl' }: { track: Track | null; className?: string; rounded?: string }) {
  const [broken, setBroken] = useState(false);
  if (!track?.artwork || broken) {
    const h = hue(track?.title || 'x');
    return (
      <div
        className={`grid place-items-center ${rounded} ${className}`}
        style={{ background: `radial-gradient(circle at 30% 20%, hsl(${h} 65% 55%), hsl(${(h + 50) % 360} 50% 22%))` }}
      >
        <Music className="size-1/3 text-white/75" />
      </div>
    );
  }
  return (
    <div className={`overflow-hidden bg-elevated ${rounded} ${className}`}>
      <img
        src={track.artwork}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setBroken(true)}
        className={`size-full object-cover ${track.source === 'youtube' ? 'scale-[1.34]' : ''}`}
      />
    </div>
  );
}
