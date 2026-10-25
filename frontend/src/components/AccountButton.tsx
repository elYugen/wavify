import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useSync } from '../lib/sync';

/** Accès au compte : initiale si connecté (point rouge hors ligne), icône sinon. */
export function AccountButton({ className = '' }: { className?: string }) {
  const user = useAuth((s) => s.user);
  const offline = useSync((s) => s.status === 'offline');
  return (
    <Link
      to="/account"
      className={`relative grid size-11 place-items-center rounded-2xl bg-white/[.06] font-display text-lg font-extrabold transition hover:bg-white/10 active:scale-90 ${className}`}
      aria-label={user ? 'Ton compte' : 'Se connecter'}
    >
      {user ? <span className="text-sunset">{user.name.slice(0, 1).toUpperCase()}</span> : <UserRound className="size-5" />}
      {offline && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-red-400 ring-2 ring-base" />}
    </Link>
  );
}
