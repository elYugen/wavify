import { hue } from '../lib/format';

/** Photo de profil, ou initiale sur un dégradé propre à chaque pseudo. */
export function Avatar({ user, className = 'size-10', text = 'text-lg' }: { user: { name: string; handle?: string; avatar?: string | null }; className?: string; text?: string }) {
  if (user.avatar) return <img src={user.avatar} alt="" className={`shrink-0 rounded-full object-cover ${className}`} draggable={false} />;
  const h = hue(user.handle || user.name);
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-display font-extrabold text-white ${text} ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 75% 60%), hsl(${(h + 50) % 360} 65% 38%))` }}
    >
      {user.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
