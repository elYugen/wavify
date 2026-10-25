import { Heart, Music } from 'lucide-react';
import type { Playlist } from '../types';
import { hue } from '../lib/format';
import { Artwork } from './Artwork';

export function PlaylistCover({
  playlist,
  liked = false,
  className = '',
  rounded = 'rounded-2xl',
}: {
  playlist?: Playlist;
  liked?: boolean;
  className?: string;
  rounded?: string;
}) {
  if (liked)
    return (
      <div className={`bg-sunset relative grid place-items-center overflow-hidden ${rounded} ${className}`}>
        <div className="absolute -right-1/4 -top-1/4 size-3/4 rounded-full bg-white/20 blur-xl" />
        <Heart className="relative size-[38%] fill-on-accent text-on-accent" />
      </div>
    );
  if (!playlist) return <div className={`bg-elevated ${rounded} ${className}`} />;
  if (playlist.cover)
    return <img src={playlist.cover} alt="" className={`object-cover ${rounded} ${className}`} draggable={false} />;
  const arts = playlist.tracks.filter((t) => t.artwork);
  const unique = arts.filter((t, i) => arts.findIndex((x) => x.artwork === t.artwork) === i);
  if (unique.length >= 4)
    return (
      <div className={`grid grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-ink ${rounded} ${className}`}>
        {unique.slice(0, 4).map((t) => (
          <Artwork key={t.id} track={t} rounded="" className="size-full" />
        ))}
      </div>
    );
  if (unique.length) return <Artwork track={unique[0]} rounded={rounded} className={className} />;
  const h = hue(playlist.id);
  return (
    <div
      className={`grid place-items-center ${rounded} ${className}`}
      style={{ background: `radial-gradient(circle at 30% 20%, hsl(${h} 70% 62% / .9), hsl(${(h + 40) % 360} 55% 30%) 60%, hsl(${h} 40% 14%))` }}
    >
      <Music className="size-[36%] text-white/80" />
    </div>
  );
}
