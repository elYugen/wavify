import { useEffect, type ReactNode } from 'react';

/** Feuille du bas sur mobile, fenêtre centrée sur desktop. */
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center" onClick={onClose}>
      <div className="animate-fade absolute inset-0 bg-ink/70 backdrop-blur-md" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border-t border-white/10 bg-surface pb-[max(env(safe-area-inset-bottom),12px)] shadow-2xl md:max-w-md md:rounded-3xl md:border md:pb-3"
      >
        <div className="sticky top-0 z-10 bg-surface pt-2.5 md:pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 md:hidden" />
          {title && <div className="px-5 pb-3">{title}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function SheetItem({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-4 rounded-2xl px-3 py-3 text-left text-[15px] font-medium transition hover:bg-white/[.06] active:bg-white/10 ${danger ? 'text-red-400' : ''}`}
    >
      <span className={`grid size-9 place-items-center rounded-xl [&>svg]:size-[19px] ${danger ? 'bg-red-500/10' : 'bg-white/[.06] text-white/80'}`}>{icon}</span>
      {label}
    </button>
  );
}
