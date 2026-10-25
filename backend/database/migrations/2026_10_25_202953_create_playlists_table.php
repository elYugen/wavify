<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('playlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Identifiant généré par le front (uid()), unique par utilisateur.
            $table->string('uid', 64);
            $table->string('name');
            $table->text('description')->nullable();
            // Peut contenir une image en data URL (~100 Ko).
            $table->mediumText('cover')->nullable();
            $table->string('imported_from')->nullable();
            $table->longText('tracks');
            // Horodatages en millisecondes, comme côté front (Date.now()).
            $table->unsignedBigInteger('created_at');
            $table->unsignedBigInteger('updated_at');
            $table->unsignedBigInteger('played_at')->nullable();
            // Suppression logique : empêche un autre appareil de ressusciter la playlist.
            $table->unsignedBigInteger('deleted_at')->nullable();

            $table->unique(['user_id', 'uid']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('playlists');
    }
};
