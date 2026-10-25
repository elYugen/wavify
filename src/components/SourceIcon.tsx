import type { Source } from '../types';

export function SourceIcon({ source, className = 'size-3.5' }: { source: Source; className?: string }) {
  if (source === 'youtube')
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="YouTube">
        <rect x="1" y="4" width="22" height="16" rx="5" fill="#ff0033" />
        <path d="M10 8.5v7l6-3.5z" fill="#fff" />
      </svg>
    );
  if (source === 'soundcloud')
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="SoundCloud">
        <path
          fill="#ff5500"
          d="M1 14.5a2 2 0 0 1 1-1.7V16a2 2 0 0 1-1-1.5Zm2.2-2.3h.8V17h-.8Zm1.8-.7h.8V17H5Zm1.8-.9h.8V17h-.8Zm1.8-1.4h.8V17h-.8Zm1.9-1.1c.7-.4 1.5-.6 2.4-.6a5.2 5.2 0 0 1 5.1 4.4 3 3 0 1 1 .9 5.9h-8.4Z"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Audius">
      <path fill="#cc0fe0" d="M12 2 23 21H1Z" />
      <path fill="#fff" d="m12 9.5 4.3 7.5H7.7Z" opacity=".9" />
    </svg>
  );
}
