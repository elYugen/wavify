import type { Source } from '../types';
import { SOURCES, SOURCE_ORDER } from '../lib/sources';
import { SourceIcon } from './SourceIcon';

/** Sélecteur de source en contrôle segmenté. */
export function SourceTabs({ value, onChange, className = '' }: { value: Source; onChange: (s: Source) => void; className?: string }) {
  return (
    <div className={`inline-flex rounded-full bg-white/[.06] p-1 ring-1 ring-white/[.06] ${className}`}>
      {SOURCE_ORDER.map((s) => {
        const active = s === value;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition active:scale-95 ${
              active ? 'bg-white text-ink shadow' : 'text-white/70 hover:text-white'
            }`}
          >
            <SourceIcon source={s} className="size-4" />
            {SOURCES[s].label}
          </button>
        );
      })}
    </div>
  );
}
