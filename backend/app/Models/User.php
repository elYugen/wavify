<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'handle', 'bio', 'avatar_path', 'banner_path'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const HANDLE_RULE = 'regex:/^[a-z0-9_.]{3,30}$/';

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            $user->handle ??= self::freeHandle($user->name);
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function playlists(): HasMany
    {
        return $this->hasMany(Playlist::class);
    }

    public function library(): HasOne
    {
        return $this->hasOne(Library::class)->withDefault();
    }

    /** Pseudo libre dérivé du nom (« Léo Martin » → leomartin, leomartin4821…). */
    public static function freeHandle(string $name): string
    {
        $base = substr(Str::slug($name, ''), 0, 20);
        $base = strlen($base) >= 3 ? $base : 'user'.$base;
        $handle = $base;
        while (self::where('handle', $handle)->exists()) {
            $handle = $base.random_int(1000, 9999);
        }

        return $handle;
    }

    /** URL d'une image du profil, versionnée pour invalider le cache à chaque changement. */
    private function imageUrl(string $kind): ?string
    {
        $path = $this->{"{$kind}_path"};

        return $path ? "/api/users/{$this->handle}/{$kind}?v=".substr(md5($path), 0, 8) : null;
    }

    /** Profil visible par tous. */
    public function toPublic(): array
    {
        return [
            'handle' => $this->handle,
            'name' => $this->name,
            'bio' => $this->bio ?? '',
            'avatar' => $this->imageUrl('avatar'),
            'banner' => $this->imageUrl('banner'),
        ];
    }

    /** Profil du compte connecté (avec l'e-mail). */
    public function toAccount(): array
    {
        return ['id' => $this->id, 'email' => $this->email, ...$this->toPublic()];
    }
}
