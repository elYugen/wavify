<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SharingTest extends TestCase
{
    use RefreshDatabase;

    private function playlist(array $patch = []): array
    {
        return [
            'name' => 'Road trip', 'description' => 'Pour la route', 'createdAt' => 1, 'updatedAt' => 2,
            'tracks' => [[
                'id' => 'youtube:abc', 'source' => 'youtube', 'sourceId' => 'abc', 'title' => 'Titre',
                'artist' => 'Artiste', 'duration' => 200, 'artwork' => '', 'url' => '',
            ]],
            ...$patch,
        ];
    }

    public function test_share_link_is_public_live_and_revocable(): void
    {
        Sanctum::actingAs(User::factory()->create(['name' => 'Léo']));
        $this->putJson('/api/playlists/p1', $this->playlist())->assertOk();

        $token = $this->postJson('/api/playlists/p1/share')->assertOk()->json('token');
        $this->assertSame($token, $this->postJson('/api/playlists/p1/share')->json('token'), 'le jeton est stable');
        $this->getJson('/api/library')->assertJsonPath('playlists.0.shareToken', $token);

        // Lisible sans être connecté, sans identifiants internes.
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/shared/{$token}")
            ->assertOk()
            ->assertJsonPath('name', 'Road trip')
            ->assertJsonPath('owner', 'Léo')
            ->assertJsonPath('tracks.0.id', 'youtube:abc')
            ->assertJsonMissingPath('user_id');

        // Toujours la version à jour.
        Sanctum::actingAs(User::first());
        $this->putJson('/api/playlists/p1', $this->playlist(['name' => 'Road trip 2', 'updatedAt' => 3]))->assertOk();
        $this->getJson("/api/shared/{$token}")->assertJsonPath('name', 'Road trip 2');

        $this->deleteJson('/api/playlists/p1/share')->assertNoContent();
        $this->getJson("/api/shared/{$token}")->assertNotFound();
    }

    public function test_deleting_playlist_kills_link_and_others_cannot_share_it(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);
        $this->putJson('/api/playlists/p1', $this->playlist())->assertOk();
        $token = $this->postJson('/api/playlists/p1/share')->json('token');

        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/playlists/p1/share')->assertNotFound();

        Sanctum::actingAs($owner);
        $this->deleteJson('/api/playlists/p1')->assertNoContent();
        $this->getJson("/api/shared/{$token}")->assertNotFound();
    }

    public function test_screen_off_option_is_synced(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->putJson('/api/playlists/p1', $this->playlist(['screenOff' => true]))->assertJsonPath('playlist.screenOff', true);
        $this->putJson('/api/library', ['likedScreenOff' => true])->assertNoContent();

        $this->getJson('/api/library')
            ->assertJsonPath('playlists.0.screenOff', true)
            ->assertJsonPath('likedScreenOff', true);

        $this->putJson('/api/playlists/p1', $this->playlist(['updatedAt' => 5]))->assertJsonMissingPath('playlist.screenOff');
    }
}
