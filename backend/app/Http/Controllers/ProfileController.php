<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    // Taille max des images après redimensionnement par le front (avatar 400 px, bannière 1500 × 500).
    private const IMAGE_MAX = 3 * 1024 * 1024;

    private const IMAGE_TYPES = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];

    /** Profil public : infos et playlists publiques. */
    public function show(string $handle)
    {
        $user = User::where('handle', $handle)->firstOrFail();
        $playlists = $user->playlists()->alive()->where('is_public', true)->whereNotNull('share_token')
            ->orderByDesc('updated_at')->get()
            ->map(fn ($p) => [
                'token' => $p->share_token,
                'name' => $p->name,
                'cover' => $p->cover,
                // Quelques pochettes pour composer une miniature quand il n'y a pas d'image.
                'artworks' => collect($p->tracks)->pluck('artwork')->filter()->unique()->take(4)->values(),
                'trackCount' => count($p->tracks ?? []),
                'updatedAt' => $p->updated_at,
            ]);

        return response()->json([...$user->toPublic(), 'playlists' => $playlists]);
    }

    /** Recherche de profils par nom ou pseudo. */
    public function search(Request $request)
    {
        $q = trim((string) $request->query('q'));
        if (mb_strlen($q) < 2) {
            return response()->json(['users' => []]);
        }
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower($q)).'%';
        $users = User::whereRaw('LOWER(name) LIKE ?', [$like])->orWhere('handle', 'like', $like)
            ->orderBy('name')->limit(10)->get();

        return response()->json(['users' => $users->map->toPublic()]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:60'],
            'handle' => ['sometimes', 'required', 'string', User::HANDLE_RULE, Rule::unique('users')->ignore($user->id)],
            'bio' => ['sometimes', 'nullable', 'string', 'max:300'],
        ], [
            'handle.regex' => 'Le pseudo doit faire 3 à 30 caractères : lettres minuscules, chiffres, « _ » ou « . ».',
            'handle.unique' => 'Ce pseudo est déjà pris.',
        ]);
        $user->update($data);

        return response()->json(['user' => $user->toAccount()]);
    }

    /** Remplace ou retire (image: null) la photo de profil ou la bannière. */
    public function image(Request $request, string $kind)
    {
        abort_unless(in_array($kind, ['avatar', 'banner']), 404);
        $request->validate(['image' => ['present', 'nullable', 'string', 'max:'.(int) (self::IMAGE_MAX * 1.4)]]);
        $user = $request->user();
        $column = "{$kind}_path";
        $old = $user->{$column};

        $path = null;
        if ($request->input('image')) {
            [$bytes, $ext] = $this->decode($request->input('image'));
            $path = "profiles/{$user->id}/{$kind}-".Str::random(8).".{$ext}";
            Storage::disk('local')->put($path, $bytes);
        }
        $user->update([$column => $path]);
        if ($old) {
            Storage::disk('local')->delete($old);
        }

        return response()->json(['user' => $user->toAccount()]);
    }

    /** Sert une image de profil (URL versionnée : mise en cache longue). */
    public function file(string $handle, string $kind)
    {
        abort_unless(in_array($kind, ['avatar', 'banner']), 404);
        $path = User::where('handle', $handle)->value("{$kind}_path");
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return response()->file(Storage::disk('local')->path($path), [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    /** Data URL → octets, en n'acceptant que de vraies images JPEG, PNG ou WebP. */
    private function decode(string $dataUrl): array
    {
        $fail = fn () => throw ValidationException::withMessages(['image' => 'Image invalide (JPEG, PNG ou WebP, 3 Mo max).']);
        if (! preg_match('#^data:image/[a-z]+;base64,(.+)$#s', $dataUrl, $m)) {
            $fail();
        }
        $bytes = base64_decode($m[1], true);
        $info = $bytes !== false && strlen($bytes) <= self::IMAGE_MAX ? @getimagesizefromstring($bytes) : false;
        if (! $info || ! isset(self::IMAGE_TYPES[$info[2]]) || $info[0] > 4000 || $info[1] > 4000) {
            $fail();
        }

        return [$bytes, self::IMAGE_TYPES[$info[2]]];
    }
}
