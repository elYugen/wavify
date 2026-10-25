import { Heart, MoreVertical, Plus } from 'lucide-react';
import type { Track } from '../types';
import { fmtTime } from '../lib/format';
import { usePlayer } from '../store/player';
import { useLibrary } from '../store/library';
import { useUi } from '../store/ui';
import { toast } from '../store/toast';
import { Artwork } from './Artwork';
import { SourceIcon } from './SourceIcon';
import { Equalizer } from './Equalizer';

interface Props {
  track: Track;
  index?: number;
  onPlay: () => void;
  playlistId?: string;
  action?: 'menu' | 'add';
  onAction?: () => void;
  showIndex?: boolean;
}

export function TrackRow({ track, index, onPlay, playlistId, action = 'menu', onAction, showIndex }: Props) {
  const isCurrent = usePlayer((s) => s.queue[s.index]?.id === track.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const liked = useLibrary((s) => s.liked.some((t) => t.id === track.id));
  const toggleLike = useLibrary((s) => s.toggleLike);
  const openMenu = useUi((s) => s.openMenu);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => e.key === 'Enter' && onPlay()}
      className={`group relative flex items-center gap-3 rounded-2xl px-2 py-2 transition md:px-3 ${
        isCurrent ? 'bg-gradient-to-r from-accent/[.16] via-accent/[.05] to-transparent' : 'hover:bg-white/[.05] active:bg-white/[.08]'
      }`}
    >
      {showIndex && (
        <div className="hidden w-7 shrink-0 text-center font-display text-sm tabular-nums text-muted md:block">
          {isCurrent ? <Equalizer playing={isPlaying} /> : String((index ?? 0) + 1).padStart(2, '0')}
        </div>
      )}
      <div className="relative shrink-0">
        <Artwork track={track} className="size-12" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-ink p-[3px]">
          <SourceIcon source={track.source} className="size-3" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] font-semibold ${isCurrent ? 'text-sunset' : 'text-white'}`}>{track.title}</div>
        <div className="truncate text-[13px] text-muted">{track.artist}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toast(toggleLike(track) ? 'Ajouté à tes coups de cœur' : 'Retiré de tes coups de cœur');
        }}
        className={`hidden p-1 transition sm:block ${liked ? 'text-accent' : 'text-muted opacity-0 hover:text-white group-hover:opacity-100'}`}
        aria-label="Coup de cœur"
      >
        <Heart className={`size-[18px] ${liked ? 'fill-accent' : ''}`} />
      </button>
      <span className="hidden w-12 text-right text-sm tabular-nums text-muted sm:block">{fmtTime(track.duration)}</span>
      {action === 'add' ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction?.();
          }}
          className="grid size-9 place-items-center rounded-full bg-white/[.08] text-white transition hover:bg-sunset hover:text-on-accent active:scale-90"
          aria-label="Ajouter"
        >
          <Plus className="size-5" />
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openMenu(track, playlistId);
          }}
          className="-mr-1 p-2 text-muted transition hover:text-white"
          aria-label="Plus d'options"
        >
          <MoreVertical className="size-5" />
        </button>
      )}
    </div>
  );
}
