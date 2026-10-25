<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    // PNG 1 × 1 valide.
    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    private function playlist(array $patch = []): array
    {
        return ['name' => 'Chill', 'description' => '', 'tracks' => [], 'createdAt' => 1, 'updatedAt' => 2, ...$patch];
    }

    public function test_handle_is_generated_and_unique(): void
    {
        $a = User::factory()->create(['name' => 'Léo Martin']);
        $b = User::factory()->create(['name' => 'Léo Martin']);
        $this->assertSame('leomartin', $a->handle);
        $this->assertMatchesRegularExpression('/^leomartin\d{4}$/', $b->handle);

        $this->postJson('/api/auth/register', ['name' => 'Zoé', 'email' => 'zoe@ex.com', 'password' => 'secret123'])
            ->assertJsonPath('user.handle', 'zoe');
    }

    public function test_profile_shows_only_public_playlists(): void
    {
        $user = User::factory()->create(['name' => 'Léo']);
        Sanctum::actingAs($user);
        $this->putJson('/api/playlists/pub', $this->playlist(['name' => 'Publique', 'isPublic' => true]))
            ->assertJsonPath('playlist.isPublic', true)
            ->assertJsonPath('playlist.shareToken', fn ($t) => strlen($t) === 24);
        $this->putJson('/api/playlists/priv', $this->playlist(['name' => 'Privée']))->assertOk();
        $this->postJson('/api/playlists/priv/share')->assertOk(); // partagée par lien, mais pas publique

        $this->getJson("/api/users/{$user->handle}")
            ->assertOk()
            ->assertJsonPath('name', 'Léo')
            ->assertJsonCount(1, 'playlists')
            ->assertJsonPath('playlists.0.name', 'Publique')
            ->assertJsonMissingPath('email');

        // Arrêter le partage la retire du profil.
        $this->deleteJson('/api/playlists/pub/share')->assertNoContent();
        $this->getJson("/api/users/{$user->handle}")->assertJsonCount(0, 'playlists');
        $this->getJson('/api/users/inconnu')->assertNotFound();
    }

    public function test_update_profile_and_handle_rules(): void
    {
        User::factory()->create(['handle' => 'pris']);
        Sanctum::actingAs(User::factory()->create());

        $this->putJson('/api/profile', ['name' => 'Léo', 'handle' => 'leo.music', 'bio' => 'Lofi et J-pop'])
            ->assertOk()
            ->assertJsonPath('user.handle', 'leo.music')
            ->assertJsonPath('user.bio', 'Lofi et J-pop');
        $this->putJson('/api/profile', ['handle' => 'pris'])->assertJsonValidationErrors(['handle' => 'Ce pseudo est déjà pris.']);
        $this->putJson('/api/profile', ['handle' => 'Pas Bon!'])->assertJsonValidationErrors('handle');
    }

    public function test_avatar_upload_serve_and_remove(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $url = $this->postJson('/api/profile/avatar', ['image' => self::PNG])->assertOk()->json('user.avatar');
        $this->assertStringStartsWith("/api/users/{$user->handle}/avatar?v=", $url);
        $this->get($url)->assertOk()->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');

        $path = $user->fresh()->avatar_path;
        $this->postJson('/api/profile/avatar', ['image' => null])->assertJsonPath('user.avatar', null);
        Storage::disk('local')->assertMissing($path);
        $this->get("/api/users/{$user->handle}/avatar")->assertNotFound();
    }

    public function test_rejects_non_images(): void
    {
        Storage::fake('local');
        Sanctum::actingAs(User::factory()->create());

        $fake = 'data:image/png;base64,'.base64_encode('<?php echo "hello"; ?>');
        $this->postJson('/api/profile/banner', ['image' => $fake])->assertJsonValidationErrors('image');
        $this->postJson('/api/profile/banner', ['image' => 'https://exemple.com/a.png'])->assertJsonValidationErrors('image');
        $this->assertEmpty(Storage::disk('local')->allFiles());
    }

    public function test_search_users(): void
    {
        User::factory()->create(['name' => 'Léo Martin', 'handle' => 'leo']);
        User::factory()->create(['name' => 'Zoé', 'handle' => 'zoe']);

        $this->getJson('/api/users?q=léo')->assertJsonCount(1, 'users')->assertJsonPath('users.0.handle', 'leo');
        $this->getJson('/api/users?q=zo')->assertJsonPath('users.0.name', 'Zoé');
        $this->getJson('/api/users?q=a')->assertJsonCount(0, 'users');
    }
}
