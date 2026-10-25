<?php

namespace App\Http\Controllers;

use App\Support\Tracks;
use Illuminate\Http\Request;

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
        $playlist->fill(['tracks' => [], 'cover' => null, 'deleted_at' => (int) floor(microtime(true) * 1000)])->save();

        return response()->noContent();
    }
}
