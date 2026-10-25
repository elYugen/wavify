<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LibrarySyncTest extends TestCase
{
    use RefreshDatabase;

    private function track(string $id): array
    {
        return [
            'id' => "youtube:$id", 'source' => 'youtube', 'sourceId' => $id, 'title' => "Titre $id",
            'artist' => 'Artiste', 'duration' => 200, 'artwork' => '', 'url' => "https://youtu.be/$id",
        ];
    }

    private function playlist(array $patch = []): array
    {
        return [
            'name' => 'Ma playlist', 'description' => '', 'tracks' => [$this->track('a')],
            'createdAt' => 1000, 'updatedAt' => 2000, ...$patch,
        ];
    }

    public function test_register_login_and_me(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Léo', 'email' => 'leo@example.com', 'password' => 'secret123'])
            ->assertCreated()->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

        $this->postJson('/api/auth/register', ['name' => 'Léo', 'email' => 'leo@example.com', 'password' => 'secret123'])
            ->assertUnprocessable()->assertJsonPath('errors.email.0', 'Un compte existe déjà avec cette adresse e-mail.');

        $this->postJson('/api/auth/login', ['email' => 'leo@example.com', 'password' => 'mauvais'])->assertUnprocessable();

        $token = $this->postJson('/api/auth/login', ['email' => 'leo@example.com', 'password' => 'secret123'])
            ->assertOk()->json('token');

        $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.email', 'leo@example.com');
    }

    public function test_library_requires_auth(): void
    {
        $this->getJson('/api/library')->assertUnauthorized();
    }

    public function test_playlist_upsert_and_library(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->putJson('/api/playlists/p1', $this->playlist())->assertOk()->assertJsonPath('stale', false);
        $this->putJson('/api/library', ['liked' => [$this->track('b'), ['source' => 'evil']], 'searches' => ['daft punk']])
            ->assertNoContent();

        $this->getJson('/api/library')
            ->assertOk()
            ->assertJsonPath('playlists.0.id', 'p1')
            ->assertJsonPath('playlists.0.tracks.0.id', 'youtube:a')
            ->assertJsonCount(1, 'liked')
            ->assertJsonPath('searches', ['daft punk']);
    }

    public function test_older_version_is_ignored(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->putJson('/api/playlists/p1', $this->playlist(['name' => 'Récente', 'updatedAt' => 5000]))->assertOk();
        $this->putJson('/api/playlists/p1', $this->playlist(['name' => 'Ancienne', 'updatedAt' => 3000, 'playedAt' => 9000]))
            ->assertOk()
            ->assertJsonPath('stale', true)
            ->assertJsonPath('playlist.name', 'Récente')
            ->assertJsonPath('playlist.playedAt', 9000);
    }

    public function test_deleted_playlist_is_not_resurrected_by_stale_copy(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->putJson('/api/playlists/p1', $this->playlist())->assertOk();
        $this->deleteJson('/api/playlists/p1')->assertNoContent();
        $this->getJson('/api/library')->assertJsonCount(0, 'playlists');

        $this->putJson('/api/playlists/p1', $this->playlist(['updatedAt' => 2500]))->assertJsonPath('stale', true);
        $this->getJson('/api/library')->assertJsonCount(0, 'playlists');
    }

    public function test_users_are_isolated(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->putJson('/api/playlists/p1', $this->playlist())->assertOk();

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/library')->assertJsonCount(0, 'playlists');
        $this->putJson('/api/playlists/p1', $this->playlist(['name' => 'À moi']))->assertJsonPath('stale', false);
    }

    public function test_search_validates_source(): void
    {
        $this->getJson('/api/search?q=test&source=deezer')->assertUnprocessable();
        $this->getJson('/api/spotify-status')->assertOk()->assertJson(['api' => false]);
    }
}
