import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

/** En-tête collant qui s'opacifie au défilement. */
export function StickyBar({ title, color, right }: { title?: ReactNode; color?: string; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 px-3 pb-2 pt-[max(env(safe-area-inset-top),8px)] transition-colors md:px-5"
      style={{ ['--bar' as string]: color || 'rgb(18 16 25 / .85)' }}
    >
      <div className="absolute inset-0 -z-10 bg-[var(--bar)] opacity-0 backdrop-blur-xl transition-opacity duration-300 group-data-[scrolled=true]/main:opacity-100" />
      <button onClick={() => navigate(-1)} className="glass grid size-10 place-items-center rounded-full transition hover:bg-white/10" aria-label="Retour">
        <ChevronLeft className="size-6" />
      </button>
      <div className="min-w-0 flex-1 truncate font-display text-lg font-bold opacity-0 transition-opacity duration-300 group-data-[scrolled=true]/main:opacity-100">{title}</div>
      {right}
    </div>
  );
}
