import { Link } from 'react-router-dom';
import type { GENRES } from '../lib/genres';

export function MoodChip({ g, to, big }: { g: (typeof GENRES)[number]; to: string; big?: boolean }) {
  const Icon = g.icon;
  return (
    <Link
      to={to}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white/[.04] ring-1 ring-white/[.06] transition hover:bg-white/[.08] active:scale-[.97] ${big ? 'p-3' : 'p-2.5'}`}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-xl text-white shadow-lg transition group-hover:rotate-[-8deg] group-hover:scale-110 ${big ? 'size-12' : 'size-10'}`}
        style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
      >
        <Icon className={big ? 'size-6' : 'size-5'} />
      </span>
      <span className="font-display text-[15px] font-bold">{g.label}</span>
      <span
        className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50"
        style={{ background: g.from }}
      />
    </Link>
  );
}
