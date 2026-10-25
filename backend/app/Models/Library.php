<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['liked', 'recent', 'searches'])]
class Library extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $attributes = ['liked' => '[]', 'recent' => '[]', 'searches' => '[]'];

    protected function casts(): array
    {
        return [
            'liked' => 'array',
            'recent' => 'array',
            'searches' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
