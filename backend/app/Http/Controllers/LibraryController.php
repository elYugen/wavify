<?php

namespace App\Http\Controllers;

use App\Support\Tracks;
use Illuminate\Http\Request;

class LibraryController extends Controller
{
    /** Bibliothèque complète : playlists, coups de cœur, historique et recherches. */
    public function show(Request $request)
    {
        $user = $request->user();
        $library = $user->library;

        return response()->json([
            'playlists' => $user->playlists()->alive()->orderByDesc('updated_at')->get()->map->toClient(),
            'liked' => $library->liked ?? [],
            'recent' => $library->recent ?? [],
            'searches' => $library->searches ?? [],
        ]);
    }

    /** Remplace les listes envoyées (les autres restent inchangées). */
    public function update(Request $request)
    {
        $request->validate([
            'liked' => ['sometimes', 'array'],
            'recent' => ['sometimes', 'array'],
            'searches' => ['sometimes', 'array', 'max:50'],
            'searches.*' => ['string', 'max:200'],
        ]);

        $library = $request->user()->library;
        if ($request->has('liked')) {
            $library->liked = Tracks::clean($request->input('liked'));
        }
        if ($request->has('recent')) {
            $library->recent = Tracks::clean($request->input('recent'), 50);
        }
        if ($request->has('searches')) {
            $library->searches = array_values($request->input('searches'));
        }
        $request->user()->library()->save($library);

        return response()->noContent();
    }
}
