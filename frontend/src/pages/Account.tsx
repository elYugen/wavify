import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CloudCheck, CloudOff, LogOut, RefreshCw, UserRound } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useLibrary } from '../store/library';
import { toast } from '../store/toast';
import { mergeAfterLogin, pull, signOut, useSync } from '../lib/sync';
import { plural } from '../lib/format';
import { Avatar } from '../components/Avatar';

const field =
  'w-full rounded-2xl bg-white/[.06] px-4 py-3.5 text-[15px] outline-none ring-accent/60 transition placeholder:text-muted focus:ring-2';

function AuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const local = useLibrary((s) => s.playlists.length + (s.liked.length ? 1 : 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
      return;
    }
    try {
      await mergeAfterLogin();
      toast(mode === 'login' ? 'Connecté, bibliothèque synchronisée' : 'Compte créé');
    } catch {
      toast('Connecté. La synchronisation reprendra plus tard.');
    }
    setBusy(false);
  };

  const tab = (m: typeof mode, label: string) => (
    <button
      type="button"
      onClick={() => (setMode(m), setError(null))}
      className={`flex-1 rounded-full py-2.5 text-sm font-bold transition ${mode === m ? 'bg-white text-ink' : 'text-white/70 hover:text-white'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-md">
      <p className="text-muted">
        Retrouve tes playlists, coups de cœur et ton historique sur tous tes appareils.
        {local > 0 && ' Ce qui est déjà sur cet appareil sera ajouté à ton compte.'}
      </p>
      <div className="mt-6 flex gap-1 rounded-full bg-white/[.06] p-1">
        {tab('login', 'Connexion')}
        {tab('register', 'Créer un compte')}
      </div>
      <form onSubmit={submit} className="mt-5 space-y-3">
        {mode === 'register' && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" autoComplete="name" required maxLength={60} className={field} />
        )}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" autoComplete="email" required className={field} />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'register' ? 'Mot de passe (8 caractères min.)' : 'Mot de passe'}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          required
          minLength={mode === 'register' ? 8 : undefined}
          className={field}
        />
        {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">{error}</p>}
        <button disabled={busy} className="bg-sunset w-full rounded-full py-3.5 font-bold text-on-accent transition hover:brightness-110 active:scale-[.98] disabled:opacity-60">
          {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>
    </div>
  );
}

function Profile() {
  const user = useAuth((s) => s.user)!;
  const { status, lastSync } = useSync();
  const { playlists, liked } = useLibrary();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    let ok = await signOut();
    if (!ok && confirm('Certaines modifications ne sont pas encore enregistrées sur ton compte. Te déconnecter quand même ?')) ok = await signOut(true);
    setBusy(false);
    if (ok) toast('Déconnecté');
  };

  const offline = status === 'offline';
  return (
    <div className="mx-auto max-w-md space-y-3">
      <Link to={`/u/${user.handle}`} className="flex items-center gap-4 rounded-[28px] bg-surface p-5 ring-1 ring-white/[.06] transition hover:bg-white/[.04]">
        <Avatar user={user} className="size-14" text="text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl font-bold">{user.name}</div>
          <div className="truncate text-sm text-muted">@{user.handle} · {user.email}</div>
          <div className="mt-1 text-xs font-bold text-accent-2">Voir et modifier mon profil</div>
        </div>
        <ChevronRight className="size-5 text-muted" />
      </Link>

      <div className="rounded-[28px] bg-surface p-5 ring-1 ring-white/[.06]">
        <div className="flex items-center gap-3">
          <span className={`grid size-10 place-items-center rounded-xl ${offline ? 'bg-red-500/10 text-red-300' : 'bg-[#1db954]/15 text-[#1ed760]'}`}>
            {offline ? <CloudOff className="size-5" /> : <CloudCheck className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold">{status === 'syncing' ? 'Synchronisation…' : offline ? 'Hors ligne' : 'Synchronisé'}</div>
            <div className="text-sm text-muted">
              {offline
                ? 'Tes modifications partiront dès le retour du réseau.'
                : `${plural(playlists.length, 'playlist')} · ${plural(liked.length, 'coup')} de cœur${lastSync ? ` · ${new Date(lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
            </div>
          </div>
          <button
            onClick={() => void pull()}
            disabled={status === 'syncing'}
            className="grid size-10 place-items-center rounded-full bg-white/[.06] transition hover:bg-white/10 disabled:opacity-50"
            aria-label="Synchroniser maintenant"
          >
            <RefreshCw className={`size-5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <button
        onClick={logout}
        disabled={busy}
        className="flex w-full items-center gap-4 rounded-[28px] bg-surface p-5 text-left font-bold text-red-300 ring-1 ring-white/[.06] transition hover:bg-white/[.04] disabled:opacity-60"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-red-500/10">
          <LogOut className="size-5" />
        </span>
        Se déconnecter
      </button>
      <p className="px-2 text-xs text-muted">La déconnexion retire ta bibliothèque de cet appareil. Elle reste sur ton compte.</p>
    </div>
  );
}

export default function Account() {
  const user = useAuth((s) => s.user);
  return (
    <div className="px-4 pb-6 pt-[max(env(safe-area-inset-top),18px)] md:px-7 md:pt-7">
      <h1 className="mb-6 flex items-center gap-3 font-display text-[32px] font-extrabold leading-none tracking-tight">
        <UserRound className="size-8 text-accent" />
        {user ? 'Ton compte' : 'Connexion'}
        <span className="-ml-3 text-sunset">.</span>
      </h1>
      {user ? <Profile /> : <AuthForm />}
    </div>
  );
}
