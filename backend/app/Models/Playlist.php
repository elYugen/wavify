<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['uid', 'name', 'description', 'cover', 'imported_from', 'tracks', 'screen_off', 'share_token', 'is_public', 'created_at', 'updated_at', 'played_at', 'deleted_at'])]
#[Hidden(['id', 'user_id'])]
class Playlist extends Model
{
    // Les horodatages viennent du front, en millisecondes.
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'tracks' => 'array',
            'screen_off' => 'boolean',
            'is_public' => 'boolean',
            'created_at' => 'integer',
            'updated_at' => 'integer',
            'played_at' => 'integer',
            'deleted_at' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeAlive(Builder $query): void
    {
        $query->whereNull('deleted_at');
    }

    /** Format attendu par le front (type Playlist de src/types.ts). */
    public function toClient(): array
    {
        return array_filter([
            'id' => $this->uid,
            'name' => $this->name,
            'description' => $this->description ?? '',
            'tracks' => $this->tracks ?? [],
            'cover' => $this->cover,
            'importedFrom' => $this->imported_from,
            'screenOff' => $this->screen_off ?: null,
            'shareToken' => $this->share_token,
            'isPublic' => $this->is_public ?: null,
            'createdAt' => $this->created_at,
            'updatedAt' => $this->updated_at,
            'playedAt' => $this->played_at,
        ], fn ($v) => $v !== null);
    }

    /** Version publique d'une playlist partagée : sans identifiants internes. */
    public function toShared(): array
    {
        return [
            'token' => $this->share_token,
            'name' => $this->name,
            'description' => $this->description ?? '',
            'cover' => $this->cover,
            'tracks' => $this->tracks ?? [],
            'owner' => $this->user->name,
            'ownerHandle' => $this->user->handle,
            'ownerAvatar' => $this->user->toPublic()['avatar'],
            'updatedAt' => $this->updated_at,
        ];
    }
}
