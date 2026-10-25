<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LibraryController;
use App\Http\Controllers\MusicController;
use App\Http\Controllers\PlaylistController;
use App\Http\Controllers\SpotifyAuthController;
use App\Http\Controllers\StreamController;
use Illuminate\Support\Facades\Route;

// Recherche et import : publics, comme avant.
Route::get('/search', [MusicController::class, 'search']);
Route::get('/spotify', [MusicController::class, 'spotify']);
Route::get('/spotify-status', [MusicController::class, 'spotifyStatus']);
Route::get('/spotify/login', [SpotifyAuthController::class, 'login']);
Route::get('/spotify/callback', [SpotifyAuthController::class, 'callback']);
Route::post('/spotify/refresh', [SpotifyAuthController::class, 'refresh'])->middleware('throttle:30,1');

// Lecture YouTube écran coupé (yt-dlp).
Route::get('/stream/status', [StreamController::class, 'status']);
Route::get('/stream/youtube/{id}', [StreamController::class, 'youtube'])->middleware('throttle:120,1');

// Playlists partagées : publiques, par lien.
Route::get('/shared/{token}', [PlaylistController::class, 'shared'])->middleware('throttle:60,1');

Route::prefix('auth')->group(function () {
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/register', [AuthController::class, 'register']);
        Route::post('/login', [AuthController::class, 'login']);
    });
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/library', [LibraryController::class, 'show']);
    Route::put('/library', [LibraryController::class, 'update']);
    Route::put('/playlists/{uid}', [PlaylistController::class, 'upsert']);
    Route::delete('/playlists/{uid}', [PlaylistController::class, 'destroy']);
    Route::post('/playlists/{uid}/share', [PlaylistController::class, 'share']);
    Route::delete('/playlists/{uid}/share', [PlaylistController::class, 'unshare']);
});
