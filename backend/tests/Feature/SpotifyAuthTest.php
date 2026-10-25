<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SpotifyAuthTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.spotify.client_id' => 'cid',
            'services.spotify.client_secret' => 'secret',
            'app.url' => 'https://music.example.com',
        ]);
    }

    public function test_login_redirects_to_spotify_with_callback(): void
    {
        $location = $this->get('/api/spotify/login')->assertRedirect()->headers->get('Location');

        $this->assertStringStartsWith('https://accounts.spotify.com/authorize?', $location);
        parse_str(parse_url($location, PHP_URL_QUERY), $q);
        $this->assertSame('https://music.example.com/api/spotify/callback', $q['redirect_uri']);
        $this->assertSame('cid', $q['client_id']);
        $this->assertNotEmpty($q['state']);
    }

    public function test_callback_rejects_unknown_state(): void
    {
        $this->get('/api/spotify/callback?code=abc&state=forged')
            ->assertRedirect()
            ->assertHeader('Location', '/import#spotify_error='.urlencode('Connexion expirée, réessaie'));
    }

    public function test_callback_exchanges_code_and_returns_tokens_to_front(): void
    {
        Http::fake(['accounts.spotify.com/api/token' => Http::response(['access_token' => 'AT', 'refresh_token' => 'RT', 'expires_in' => 3600])]);
        parse_str(parse_url($this->get('/api/spotify/login')->headers->get('Location'), PHP_URL_QUERY), $q);

        $location = $this->get("/api/spotify/callback?code=abc&state={$q['state']}")->headers->get('Location');
        $this->assertSame('/import#spotify_token=AT&spotify_refresh=RT&spotify_expires=3600', $location);

        // Le state ne sert qu'une fois.
        $this->get("/api/spotify/callback?code=abc&state={$q['state']}")->assertHeader('Location', '/import#spotify_error='.urlencode('Connexion expirée, réessaie'));
    }

    public function test_playlist_import_uses_user_token_and_paginates(): void
    {
        $id = str_repeat('a', 22);
        $item = fn ($n) => ['item' => ['type' => 'track', 'name' => "Titre $n", 'artists' => [['name' => 'Artiste']], 'duration_ms' => 1000]];
        Http::fake([
            "api.spotify.com/v1/playlists/{$id}?*" => Http::response(['name' => 'Ma playlist', 'owner' => ['display_name' => 'Léo'], 'images' => []]),
            "api.spotify.com/v1/playlists/{$id}/tracks*" => Http::response([], 404),
            "api.spotify.com/v1/playlists/{$id}/items?limit=100&market=FR" => Http::response(['items' => array_map($item, range(1, 100)), 'next' => "https://api.spotify.com/v1/playlists/{$id}/items?offset=100"]),
            "api.spotify.com/v1/playlists/{$id}/items?offset=100" => Http::response(['items' => array_map($item, range(101, 150)), 'next' => null]),
        ]);

        $this->withHeader('X-Spotify-Token', 'USER')
            ->getJson("/api/spotify?url=https://open.spotify.com/playlist/{$id}")
            ->assertOk()
            ->assertJsonPath('via', 'api')
            ->assertJsonPath('limited', false)
            ->assertJsonCount(150, 'tracks');

        Http::assertSent(fn ($r) => str_contains($r->url(), '/items') && $r->hasHeader('Authorization', 'Bearer USER'));
    }
}
