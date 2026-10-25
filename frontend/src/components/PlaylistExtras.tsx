import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Globe, Link2, LoaderCircle, Moon, Share2 } from 'lucide-react';
import type { Playlist } from '../types';
import { HttpError, sharePlaylist, unsharePlaylist } from '../lib/api';
import { flush } from '../lib/sync';
import { useAuth } from '../store/auth';
import { useLibrary } from '../store/library';
import { usePlayer, useStreamSupport } from '../store/player';
import { toast } from '../store/toast';
import { Sheet } from './Sheet';

/** Bouton « Écran coupé » : YouTube via le serveur pour continuer écran éteint (si yt-dlp y est installé). */
export function ScreenOffToggle({ contextId }: { contextId: string }) {
  const supported = useStreamSupport((s) => s.youtube);
  const on = useLibrary((s) => (contextId === 'liked' ? s.likedScreenOff : !!s.playlists.find((p) => p.id === contextId)?.screenOff));
  const setScreenOff = useLibrary((s) => s.setScreenOff);
  const playingHere = usePlayer((s) => s.contextId === contextId && s.isPlaying);
  if (!supported) return null;
  return (
    <button
      onClick={() => {
        setScreenOff(contextId, !on);
        toast(
          !on
            ? `Écran coupé activé : la musique continue écran éteint${playingHere ? ', dès le prochain titre' : ''}`
            : 'Écran coupé désactivé : démarrage immédiat des titres',
        );
      }}
      className={`flex h-12 items-center gap-2 rounded-full px-4 text-sm font-bold ring-1 transition ${
        on ? 'bg-lilac/15 text-lilac ring-lilac/40' : 'text-white/85 ring-white/15 hover:ring-white/40'
      }`}
      aria-pressed={on}
      title="Lecture écran éteint (démarrage des titres YouTube plus lent)"
    >
      <Moon className={`size-5 ${on ? 'fill-current' : ''}`} /> <span className="hidden sm:inline">Écran coupé</span>
    </button>
  );
}

/** Fenêtre de partage : crée le lien public de la playlist, le copie ou l'envoie, ou le révoque. */
export function ShareSheet({ playlist, open, onClose }: { playlist: Playlist; open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user);
  const setShareToken = useLibrary((s) => s.setShareToken);
  const updatePlaylist = useLibrary((s) => s.updatePlaylist);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const url = playlist.shareToken ? `${location.origin}/s/${playlist.shareToken}` : null;

  const create = async () => {
    setBusy(true);
    try {
      // La playlist doit être sur le serveur avant d'être partagée.
      if (!(await flush())) throw new Error('Serveur injoignable, réessaie quand tu seras en ligne');
      const { token } = await sharePlaylist(playlist.id);
      setShareToken(playlist.id, token);
    } catch (e) {
      toast(e instanceof HttpError && e.status === 404 ? "Cette playlist n'est pas encore sur ton compte, réessaie dans un instant" : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url!);
      toast('Lien copié');
    } catch {
      toast('Copie impossible : sélectionne le lien pour le copier');
    }
  };

  const send = () => navigator.share({ title: playlist.name, text: `Écoute « ${playlist.name} » sur Wavify`, url: url! }).catch(() => {});

  /** Afficher sur le profil : le serveur crée alors le lien de partage s'il n'existe pas. */
  const togglePublic = async () => {
    setBusy(true);
    updatePlaylist(playlist.id, { isPublic: !playlist.isPublic });
    const ok = await flush();
    setBusy(false);
    if (!ok) toast('Hors ligne : ce sera appliqué au retour du réseau');
    else toast(playlist.isPublic ? 'Retirée de ton profil' : 'Visible sur ton profil');
  };

  const publicRow = (
    <button onClick={togglePublic} disabled={busy} className="flex w-full items-center gap-3 rounded-2xl bg-white/[.04] p-3 text-left ring-1 ring-white/[.06] disabled:opacity-60">
      <span className={`grid size-10 place-items-center rounded-xl ${playlist.isPublic ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[.06] text-white/70'}`}>
        <Globe className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Afficher sur mon profil</span>
        <span className="block text-xs text-muted">{playlist.isPublic ? 'Visible par tous sur ta page' : 'Seules les personnes qui ont le lien la voient'}</span>
      </span>
      <span className={`h-6 w-11 rounded-full p-0.5 transition ${playlist.isPublic ? 'bg-emerald-400' : 'bg-white/15'}`}>
        <span className={`block size-5 rounded-full bg-white transition ${playlist.isPublic ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );

  const revoke = async () => {
    setBusy(true);
    try {
      await unsharePlaylist(playlist.id);
      setShareToken(playlist.id, undefined);
      toast('Le lien ne fonctionne plus');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={<div className="font-display text-xl font-bold">Partager « {playlist.name} »</div>}>
      <div className="space-y-4 px-5 pb-3">
        {!user ? (
          <>
            <p className="text-sm text-white/80">Pour partager une playlist, elle doit être enregistrée sur ton compte Wavify.</p>
            <button onClick={() => (onClose(), navigate('/account'))} className="bg-sunset w-full rounded-full py-3 font-bold text-on-accent">
              Se connecter
            </button>
          </>
        ) : !url ? (
          <>
            <p className="text-sm text-white/80">
              Toute personne qui a le lien pourra écouter la playlist et l'ajouter à sa collection, sans compte. Elle verra toujours la dernière version.
            </p>
            <button onClick={create} disabled={busy} className="bg-sunset flex w-full items-center justify-center gap-2 rounded-full py-3 font-bold text-on-accent disabled:opacity-60">
              {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Link2 className="size-5" />} Créer le lien de partage
            </button>
            {publicRow}
          </>
        ) : (
          <>
            <input
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-2xl bg-white/[.06] px-4 py-3 text-sm font-semibold text-white/90 outline-none ring-accent/60 focus:ring-2"
            />
            <div className="flex flex-wrap gap-2">
              {'share' in navigator && (
                <button onClick={send} className="bg-sunset flex flex-1 items-center justify-center gap-2 rounded-full py-3 font-bold text-on-accent">
                  <Share2 className="size-5" /> Envoyer
                </button>
              )}
              <button onClick={copy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 py-3 font-bold hover:bg-white/15">
                <Copy className="size-5" /> Copier le lien
              </button>
            </div>
            {publicRow}
            <button onClick={revoke} disabled={busy} className="w-full py-2 text-sm font-semibold text-red-300 hover:text-red-200 disabled:opacity-60">
              Arrêter le partage
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
