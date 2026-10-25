import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, Copy, ImagePlus, LoaderCircle, Music, Pencil, Share2, Trash2 } from 'lucide-react';
import type { PublicProfile } from '../types';
import { fetchProfile } from '../lib/api';
import { bannerImage, coverFromArtwork, squareImage } from '../lib/image';
import { hue, plural } from '../lib/format';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';
import { Avatar } from '../components/Avatar';
import { StickyBar } from '../components/PageHeader';
import { Sheet } from '../components/Sheet';

type Card = PublicProfile['playlists'][number];

function PlaylistCard({ p }: { p: Card }) {
  const h = hue(p.token);
  return (
    <Link to={`/s/${p.token}`} className="group block min-w-0">
      {p.cover ? (
        <img src={p.cover} alt="" className="aspect-square w-full rounded-2xl object-cover shadow-xl transition group-hover:scale-[1.02]" />
      ) : p.artworks.length >= 4 ? (
        <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-2xl bg-ink shadow-xl transition group-hover:scale-[1.02]">
          {p.artworks.slice(0, 4).map((a) => (
            <img key={a} src={coverFromArtwork(a)} alt="" className="size-full object-cover" />
          ))}
        </div>
      ) : p.artworks.length ? (
        <img src={coverFromArtwork(p.artworks[0])} alt="" className="aspect-square w-full rounded-2xl object-cover shadow-xl transition group-hover:scale-[1.02]" />
      ) : (
        <div
          className="grid aspect-square w-full place-items-center rounded-2xl shadow-xl"
          style={{ background: `radial-gradient(circle at 30% 20%, hsl(${h} 70% 62% / .9), hsl(${(h + 40) % 360} 55% 30%) 60%, hsl(${h} 40% 14%))` }}
        >
          <Music className="size-1/3 text-white/80" />
        </div>
      )}
      <div className="mt-2 truncate font-display font-bold">{p.name}</div>
      <div className="text-xs text-muted">{plural(p.trackCount, 'titre')}</div>
    </Link>
  );
}

/** Modification du profil du compte connecté. */
function EditProfile({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (handle: string) => void }) {
  const { user, updateProfile, setImage } = useAuth();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setHandle(user.handle);
      setBio(user.bio);
      setError(null);
    }
  }, [open, user]);
  if (!user) return null;

  const image = async (kind: 'avatar' | 'banner', file?: File | null) => {
    setBusy(kind);
    try {
      await setImage(kind, file ? await (kind === 'avatar' ? squareImage(file, 400) : bannerImage(file)) : null);
      onSaved(useAuth.getState().user!.handle);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(null);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('save');
    setError(null);
    try {
      await updateProfile({ name: name.trim(), handle: handle.trim().toLowerCase(), bio: bio.trim() });
      toast('Profil enregistré');
      onSaved(useAuth.getState().user!.handle);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const field = 'w-full rounded-2xl bg-white/[.06] px-4 py-3 text-[15px] outline-none ring-accent/60 placeholder:text-muted focus:ring-2';
  return (
    <Sheet open={open} onClose={onClose} title={<div className="font-display text-xl font-bold">Modifier le profil</div>}>
      <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => (image('avatar', e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={bannerInput} type="file" accept="image/*" hidden onChange={(e) => (image('banner', e.target.files?.[0]), (e.target.value = ''))} />
      <div className="px-5">
        <button onClick={() => bannerInput.current?.click()} className="relative block aspect-[3/1] w-full overflow-hidden rounded-2xl bg-white/[.06]" aria-label="Changer la bannière">
          {user.banner ? <img src={user.banner} alt="" className="size-full object-cover" /> : <div className="bg-sunset size-full opacity-60" />}
          <span className="absolute inset-0 grid place-items-center bg-ink/40 text-sm font-bold">
            {busy === 'banner' ? <LoaderCircle className="size-6 animate-spin" /> : <span className="flex items-center gap-2"><ImagePlus className="size-5" /> Bannière</span>}
          </span>
        </button>
        <div className="-mt-10 ml-4 flex items-end gap-3">
          <button onClick={() => avatarInput.current?.click()} className="relative rounded-full ring-4 ring-surface" aria-label="Changer la photo">
            <Avatar user={user} className="size-20" text="text-3xl" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/45">
              {busy === 'avatar' ? <LoaderCircle className="size-6 animate-spin" /> : <Camera className="size-6" />}
            </span>
          </button>
          <div className="flex gap-3 pb-1 text-xs font-semibold text-muted">
            {user.avatar && <button onClick={() => image('avatar', null)} className="flex items-center gap-1 hover:text-white"><Trash2 className="size-3.5" /> Photo</button>}
            {user.banner && <button onClick={() => image('banner', null)} className="flex items-center gap-1 hover:text-white"><Trash2 className="size-3.5" /> Bannière</button>}
          </div>
        </div>
      </div>
      <form onSubmit={save} className="space-y-3 px-5 pb-2 pt-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom affiché" maxLength={60} required className={field} />
        <label className={`${field} flex items-center gap-1`}>
          <span className="text-muted">@</span>
          <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="pseudo" maxLength={30} required className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Quelques mots sur toi et tes goûts musicaux" maxLength={300} rows={3} className={`${field} resize-none`} />
        {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-full px-6 py-3 font-bold text-muted hover:text-white">Annuler</button>
          <button disabled={!!busy} className="bg-sunset rounded-full px-7 py-3 font-bold text-on-accent disabled:opacity-60">Enregistrer</button>
        </div>
      </form>
    </Sheet>
  );
}

export default function Profile() {
  const { handle = '' } = useParams();
  const navigate = useNavigate();
  const me = useAuth((s) => s.user);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const mine = me?.handle === handle;

  const load = (h = handle) =>
    fetchProfile(h)
      .then((p) => (setProfile(p), setError(null)))
      .catch((e) => setError(e.status === 404 ? "Ce profil n'existe pas." : e.message));
  useEffect(() => {
    setProfile(null);
    load();
  }, [handle]);

  const share = async () => {
    const url = `${location.origin}/u/${handle}`;
    if (navigator.share) return navigator.share({ title: profile?.name, url }).catch(() => {});
    try {
      await navigator.clipboard.writeText(url);
      toast('Lien du profil copié');
    } catch {
      toast(url);
    }
  };

  if (error)
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="text-xl font-bold">Profil introuvable</p>
          <p className="mt-2 text-muted">{error}</p>
          <button onClick={() => navigate('/')} className="bg-sunset mt-4 rounded-full px-5 py-2 font-bold text-on-accent">Accueil</button>
        </div>
      </div>
    );

  if (!profile) return <div className="grid h-64 place-items-center"><LoaderCircle className="size-7 animate-spin text-muted" /></div>;

  return (
    <div className="relative pb-10">
      <div className="absolute inset-x-0 top-0 aspect-[3/1] max-h-[340px] w-full overflow-hidden md:rounded-t-[28px]">
        {profile.banner ? <img src={profile.banner} alt="" className="size-full object-cover" /> : <div className="bg-sunset size-full opacity-50" />}
        <div className="absolute inset-x-0 -bottom-px top-0 bg-gradient-to-b from-transparent via-transparent to-base" />
      </div>
      <StickyBar title={profile.name} />

      {/* La photo chevauche le bas de la bannière (3:1), sous la barre du haut (~60 px). */}
      <div className="relative px-4 pt-[max(0px,min(calc(33.3vw-120px),220px))] md:px-7">
        <div className="flex flex-wrap items-end gap-4">
          <Avatar user={profile} className="size-28 ring-4 ring-base md:size-36" text="text-5xl" />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate font-display text-[32px] font-extrabold leading-tight tracking-tight md:text-5xl">{profile.name}</h1>
            <p className="text-sm font-semibold text-muted">@{profile.handle}</p>
          </div>
          <div className="flex gap-2 pb-1">
            <button onClick={share} className="grid size-11 place-items-center rounded-full ring-1 ring-white/15 hover:ring-white/40" aria-label="Partager le profil">
              {'share' in navigator ? <Share2 className="size-5" /> : <Copy className="size-5" />}
            </button>
            {mine && (
              <button onClick={() => setEditing(true)} className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-ink">
                <Pencil className="size-4" /> Modifier
              </button>
            )}
          </div>
        </div>
        {profile.bio && <p className="mt-4 max-w-2xl whitespace-pre-line text-white/80">{profile.bio}</p>}

        <h2 className="mt-10 font-display text-xl font-extrabold">Playlists publiques</h2>
        {profile.playlists.length ? (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {profile.playlists.map((p) => (
              <PlaylistCard key={p.token} p={p} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {mine ? 'Rends une playlist publique depuis son bouton « Partager » pour qu’elle apparaisse ici.' : 'Aucune playlist publique pour l’instant.'}
          </p>
        )}
      </div>
      {mine && (
        <EditProfile
          open={editing}
          onClose={() => setEditing(false)}
          onSaved={(h) => (h !== handle ? navigate(`/u/${h}`, { replace: true }) : load())}
        />
      )}
    </div>
  );
}
