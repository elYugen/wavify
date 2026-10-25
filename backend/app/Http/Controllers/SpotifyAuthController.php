<?php

namespace App\Http\Controllers;

use App\Services\MusicSources;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * « Connecter Spotify » (OAuth Authorization Code). Depuis février 2026, Spotify ne donne les titres
 * d'une playlist qu'à son créateur ou ses collaborateurs : il faut donc un jeton de l'utilisateur.
 * Le secret reste ici ; le navigateur ne garde que le jeton d'accès et le jeton de rafraîchissement.
 */
class SpotifyAuthController extends Controller
{
    private const SCOPES = 'playlist-read-private playlist-read-collaborative';

    public function login()
    {
        if (! MusicSources::spotifyEnabled()) {
            return $this->backToImport(['spotify_error' => 'Clés Spotify absentes du serveur']);
        }
        $state = Str::random(40);
        Cache::put("sp:state:{$state}", true, now()->addMinutes(10));

        return redirect()->away('https://accounts.spotify.com/authorize?'.http_build_query([
            'client_id' => config('services.spotify.client_id'),
            'response_type' => 'code',
            'redirect_uri' => self::redirectUri(),
            'scope' => self::SCOPES,
            'state' => $state,
        ]));
    }

    public function callback(Request $request)
    {
        $state = (string) $request->query('state');
        if (! $state || ! Cache::pull("sp:state:{$state}")) {
            return $this->backToImport(['spotify_error' => 'Connexion expirée, réessaie']);
        }
        if ($request->query('error') || ! $request->query('code')) {
            return $this->backToImport(['spotify_error' => 'Connexion à Spotify annulée']);
        }

        $r = $this->tokenRequest([
            'grant_type' => 'authorization_code',
            'code' => $request->query('code'),
            'redirect_uri' => self::redirectUri(),
        ]);
        if (! $r->ok()) {
            report(new \RuntimeException('Spotify OAuth : '.$r->body()));

            return $this->backToImport(['spotify_error' => 'Spotify a refusé la connexion (compte ajouté dans « User Management » du dashboard ?)']);
        }

        return $this->backToImport([
            'spotify_token' => $r->json('access_token'),
            'spotify_refresh' => $r->json('refresh_token'),
            'spotify_expires' => $r->json('expires_in'),
        ]);
    }

    public function refresh(Request $request)
    {
        $data = $request->validate(['refresh_token' => ['required', 'string', 'max:1000']]);
        $r = $this->tokenRequest(['grant_type' => 'refresh_token', 'refresh_token' => $data['refresh_token']]);
        if (! $r->ok()) {
            return response()->json(['error' => 'Session Spotify expirée, reconnecte-toi'], 401);
        }

        return response()->json([
            'access_token' => $r->json('access_token'),
            'refresh_token' => $r->json('refresh_token'),
            'expires_in' => $r->json('expires_in'),
        ]);
    }

    /** Doit être déclarée telle quelle dans « Redirect URIs » du dashboard Spotify. */
    public static function redirectUri(): string
    {
        return config('services.spotify.redirect') ?: rtrim(config('app.url'), '/').'/api/spotify/callback';
    }

    private function tokenRequest(array $form)
    {
        return Http::asForm()
            ->withBasicAuth(config('services.spotify.client_id'), config('services.spotify.client_secret'))
            ->timeout(15)
            ->post('https://accounts.spotify.com/api/token', $form);
    }

    /** Retour vers la page d'import du front (URL relative : même domaine que le callback). */
    private function backToImport(array $params)
    {
        return response('', 302)->header('Location', '/import#'.http_build_query($params));
    }
}
