import { useRef, useState } from 'react';

interface Props {
  value: number;
  max: number;
  onCommit: (v: number) => void;
  onScrub?: (v: number | null) => void;
  className?: string;
  thick?: boolean;
}

/** Barre de progression tactile (glisser pour chercher). */
export function Slider({ value, max, onCommit, onScrub, className = '', thick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;
  const pct = max > 0 ? Math.min(100, Math.max(0, (shown / max) * 100)) : 0;

  const valueAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * max;
  };

  return (
    <div
      ref={ref}
      className={`group relative flex h-4 cursor-pointer touch-none items-center ${className}`}
      onPointerDown={(e) => {
        if (!max) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const v = valueAt(e.clientX);
        setDrag(v);
        onScrub?.(v);
      }}
      onPointerMove={(e) => {
        if (drag === null) return;
        const v = valueAt(e.clientX);
        setDrag(v);
        onScrub?.(v);
      }}
      onPointerUp={() => {
        if (drag !== null) onCommit(drag);
        setDrag(null);
        onScrub?.(null);
      }}
      onPointerCancel={() => {
        setDrag(null);
        onScrub?.(null);
      }}
    >
      <div className={`relative w-full overflow-hidden rounded-full bg-white/15 ${thick ? 'h-1.5' : 'h-1'}`}>
        <div
          className="bg-sunset absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`absolute size-3.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,106,61,.25)] transition-opacity ${drag !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${thick ? 'opacity-100' : ''}`}
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
