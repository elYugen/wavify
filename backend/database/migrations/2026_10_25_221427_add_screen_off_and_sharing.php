<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('playlists', function (Blueprint $table) {
            // Option « Écran coupé » : YouTube lu via yt-dlp pour continuer écran éteint.
            $table->boolean('screen_off')->default(false)->after('tracks');
            // Lien de partage public (/s/{token}), null si la playlist n'est pas partagée.
            $table->string('share_token', 32)->nullable()->unique()->after('screen_off');
        });

        Schema::table('libraries', function (Blueprint $table) {
            $table->boolean('liked_screen_off')->default(false)->after('searches');
        });
    }

    public function down(): void
    {
        Schema::table('playlists', function (Blueprint $table) {
            $table->dropUnique(['share_token']);
            $table->dropColumn(['screen_off', 'share_token']);
        });

        Schema::table('libraries', function (Blueprint $table) {
            $table->dropColumn('liked_screen_off');
        });
    }
};
