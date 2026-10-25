<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Pseudo public : adresse du profil (/u/{handle}).
            $table->string('handle', 30)->nullable()->unique()->after('name');
            $table->string('bio', 300)->nullable()->after('handle');
            // Images stockées dans storage/app/private/profiles, servies par l'API.
            $table->string('avatar_path')->nullable()->after('bio');
            $table->string('banner_path')->nullable()->after('avatar_path');
        });

        // Pseudo pour les comptes déjà créés.
        foreach (DB::table('users')->whereNull('handle')->get(['id', 'name']) as $u) {
            DB::table('users')->where('id', $u->id)->update(['handle' => User::freeHandle($u->name)]);
        }

        Schema::table('playlists', function (Blueprint $table) {
            // Affichée sur le profil (implique un lien de partage).
            $table->boolean('is_public')->default(false)->after('share_token');
        });
    }

    public function down(): void
    {
        Schema::table('playlists', function (Blueprint $table) {
            $table->dropColumn('is_public');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['handle']);
            $table->dropColumn(['handle', 'bio', 'avatar_path', 'banner_path']);
        });
    }
};
