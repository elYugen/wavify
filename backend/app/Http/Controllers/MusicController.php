<?php

namespace App\Http\Controllers;

use App\Services\MusicSources;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

class MusicController extends Controller
{
    public function __construct(private MusicSources $sources) {}

    public function search(Request $request)
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'max:300'],
            'source' => ['sometimes', Rule::in(MusicSources::SOURCES)],
        ], ['q.required' => 'Paramètre q manquant', 'source.in' => 'Source inconnue']);

        $q = trim($data['q']);
        $source = $data['source'] ?? 'youtube';

        return $this->upstream(fn () => [
            'results' => Cache::remember(
                's:'.$source.':'.md5(mb_strtolower($q)),
                now()->addMinutes(30),
                fn () => $this->sources->search($source, $q),
            ),
        ]);
    }

    public function spotify(Request $request)
    {
        $url = (string) $request->query('url', '');
        // Jeton de l'utilisateur connecté à Spotify (voir SpotifyAuthController), facultatif.
        $token = $request->header('X-Spotify-Token') ?: null;

        return $this->upstream(fn () => Cache::remember(
            'sp:'.md5($url.'|'.$token),
            now()->addMinutes(10),
            fn () => $this->sources->spotifyPlaylist($url, $token),
        ));
    }

    public function spotifyStatus()
    {
        return response()->json(['api' => MusicSources::spotifyEnabled()]);
    }

    /** Une source externe en panne renvoie 502 avec le message, comme l'ancien serveur Node. */
    private function upstream(callable $fn)
    {
        try {
            return response()->json($fn());
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['error' => $e->getMessage() ?: 'Erreur serveur'], 502);
        }
    }
}
