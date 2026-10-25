# Wavify API (Laravel)

Backend de Wavify : comptes (Sanctum), synchronisation de la bibliothèque, recherche YouTube / SoundCloud / Audius et import Spotify.
Voir le [README principal](../README.md) pour le lancement et la mise en production.

- `app/Services/MusicSources.php` : recherche et import (sources externes)
- `app/Http/Controllers/` : auth, bibliothèque, playlists, recherche
- `routes/api.php` : routes
- `tests/Feature/LibrarySyncTest.php` : tests (`php artisan test`)
