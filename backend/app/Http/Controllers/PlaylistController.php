<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use App\Support\Tracks;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlaylistController extends Controller
{
    /** Crée ou met à jour une playlist (identifiée par l'id généré côté front). */
    public function upsert(Request $request, string $uid)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'cover' => ['nullable', 'string', 'max:2000000'],
            'importedFrom' => ['nullable', 'string', 'max:255'],
            'tracks' => ['present', 'array', 'max:'.Tracks::MAX],
            'createdAt' => ['required', 'integer', 'min:0'],
            'updatedAt' => ['required', 'integer', 'min:0'],
            'playedAt' => ['nullable', 'integer', 'min:0'],
            'screenOff' => ['nullable', 'boolean'],
            'isPublic' => ['nullable', 'boolean'],
        ]);

        $playlist = $request->user()->playlists()->firstOrNew(['uid' => $uid]);

        // Supprimée depuis, ou version plus récente déjà reçue d'un autre appareil : on garde le serveur.
        $deleted = $playlist->exists && $playlist->deleted_at !== null;
        if ($deleted && $playlist->deleted_at >= $data['updatedAt']) {
            return response()->json(['playlist' => null, 'stale' => true]);
        }
        if ($playlist->exists && ! $deleted && $playlist->updated_at > $data['updatedAt']) {
            if (($data['playedAt'] ?? 0) > ($playlist->played_at ?? 0)) {
                $playlist->update(['played_at' => $data['playedAt']]);
            }

            return response()->json(['playlist' => $playlist->toClient(), 'stale' => true]);
        }

        $playlist->fill([
            'name' => $data['name'],
            'description' => $data['description'] ?? '',
            'cover' => $data['cover'] ?? null,
            'imported_from' => $data['importedFrom'] ?? null,
            'tracks' => Tracks::clean($data['tracks']),
            'screen_off' => (bool) ($data['screenOff'] ?? false),
            'is_public' => $public = (bool) ($data['isPublic'] ?? false),
            // Une playlist publique est ouverte depuis le profil par son lien de partage.
            'share_token' => $public ? ($playlist->share_token ?: Str::random(24)) : $playlist->share_token,
            'created_at' => $playlist->exists && ! $deleted ? $playlist->created_at : $data['createdAt'],
            'updated_at' => $data['updatedAt'],
            'played_at' => $data['playedAt'] ?? null,
            'deleted_at' => null,
        ])->save();

        return response()->json(['playlist' => $playlist->toClient(), 'stale' => false]);
    }

    public function destroy(Request $request, string $uid)
    {
        // On garde une trace (tombstone) : une copie hors ligne sur un autre appareil ne la recréera pas.
        $playlist = $request->user()->playlists()->firstOrNew(['uid' => $uid], [
            'name' => '',
            'created_at' => 0,
            'updated_at' => 0,
        ]);
        $playlist->fill(['tracks' => [], 'cover' => null, 'share_token' => null, 'is_public' => false, 'deleted_at' => (int) floor(microtime(true) * 1000)])->save();

        return response()->noContent();
    }

    /** Active le lien de partage (le même jeton est gardé tant qu'il n'est pas révoqué). */
    public function share(Request $request, string $uid)
    {
        $playlist = $request->user()->playlists()->alive()->where('uid', $uid)->firstOrFail();
        if (! $playlist->share_token) {
            $playlist->update(['share_token' => Str::random(24)]);
        }

        return response()->json(['token' => $playlist->share_token]);
    }

    /** Révoque le lien : il ne fonctionnera plus, même pour ceux qui l'ont reçu. */
    public function unshare(Request $request, string $uid)
    {
        // Sans lien, elle ne peut plus être publique.
        $request->user()->playlists()->where('uid', $uid)->update(['share_token' => null, 'is_public' => false]);

        return response()->noContent();
    }

    /** Playlist partagée, lisible par tous (toujours la version à jour). */
    public function shared(string $token)
    {
        $playlist = Playlist::with('user')->alive()->where('share_token', $token)->firstOrFail();

        return response()->json($playlist->toShared());
    }
}
