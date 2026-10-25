# Wavify

Clone de Spotify en **React + TypeScript + Tailwind CSS 4**, installable en **PWA** sur smartphone, avec une API **Laravel**.
Il cherche et lit de la musique gratuite depuis **YouTube**, **SoundCloud** et **Audius**, gère des playlists et importe des playlists **Spotify**.

## Structure

```
backend/    API Laravel : comptes, synchro de la bibliothèque, recherche, import Spotify
frontend/   PWA React + TypeScript + Tailwind
```

## Lancer en local

Il faut PHP 8.3+, Composer et Node 20+.

```bash
# Terminal 1 : l'API (http://127.0.0.1:8000)
cd backend
composer install
cp .env.example .env && php artisan key:generate   # première fois seulement
php artisan migrate
php artisan serve

# Terminal 2 : le front (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Vite relaie `/api` vers Laravel (`API_URL` pour changer l'adresse, par défaut `http://127.0.0.1:8000`).
En dev la base est un fichier SQLite (`backend/database/database.sqlite`).

> **Windows** : si la recherche renvoie « cURL error 60 », PHP n'a pas de certificats racine. Dans `php.ini`, mets
> `curl.cainfo` et `openssl.cafile` sur un fichier `cacert.pem` (par ex. celui de Git : `C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt`).

> L'installation PWA (« Ajouter à l'écran d'accueil ») exige HTTPS.

## Comment ça marche

| Besoin | Solution | Clé API |
| --- | --- | --- |
| Recherche YouTube | API InnerTube (celle du site youtube.com), API officielle Data v3 si `YOUTUBE_API_KEY` est défini | Non |
| Lecture YouTube | IFrame Player API officielle | Non |
| Recherche SoundCloud | API web `api-v2` avec le client_id public du site | Non |
| Lecture SoundCloud | Widget API officielle | Non |
| Recherche + lecture Audius | API publique Audius (musique libre, flux audio direct) | Non |
| Import Spotify | API Web officielle si les clés sont configurées, sinon page « embed » publique (100 titres max) | Facultative |
| Import CSV | Fichier exporté depuis [Exportify](https://exportify.net) ou tout CSV avec colonnes titre et artiste | Non |

### Comptes et synchronisation

Sans compte, tout reste dans le `localStorage` du navigateur, comme avant.
Avec un compte (page **Compte**, icône en haut de l'accueil), les playlists, coups de cœur, l'historique et les recherches sont enregistrés en base et suivent l'utilisateur sur tous ses appareils :

- à la connexion, ce qui est déjà sur l'appareil est fusionné dans le compte ;
- chaque modification part au serveur (file d'attente gardée hors ligne, renvoyée au retour du réseau) ;
- la version du serveur est rechargée à l'ouverture de l'app et au retour dessus ;
- entre deux appareils, la version la plus récente d'une playlist gagne, et une playlist supprimée ne revient pas ;
- la déconnexion vide l'appareil (tout reste sur le compte).

Authentification par jeton [Sanctum](https://laravel.com/docs/sanctum). Code : `backend/app/Http/Controllers/` et `frontend/src/lib/sync.ts`.

### API

| Méthode | Route | Auth |
| --- | --- | --- |
| GET | `/api/search?source=youtube\|soundcloud\|audius&q=` | – |
| GET | `/api/spotify?url=` · `/api/spotify-status` | – |
| POST | `/api/auth/register` `{name, email, password}` · `/api/auth/login` `{email, password}` → `{token, user}` | – |
| GET / POST | `/api/auth/me` · `/api/auth/logout` | Bearer |
| GET / PUT | `/api/library` (`{liked?, recent?, searches?}` en PUT) | Bearer |
| PUT / DELETE | `/api/playlists/{id}` | Bearer |

Tests : `cd backend && php artisan test`.

## Mise en production

1. **Front** : `cd frontend && npm ci && npm run build`, ce qui produit `frontend/dist/`.
2. **Backend** : dans `backend/`, `composer install --no-dev --optimize-autoloader`, puis un `.env` avec
   `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://music.lleroy.fr`, `DB_CONNECTION=mariadb` et les accès MariaDB.
   Ensuite `php artisan key:generate`, `php artisan migrate --force` et `php artisan optimize`.
   `storage/` et `bootstrap/cache/` doivent être accessibles en écriture par l'utilisateur de PHP-FPM.
3. **Nginx** : le front et l'API sur le même domaine (exemple, chemins à adapter) :

```nginx
server {
    server_name music.lleroy.fr;
    root /var/www/wavify/frontend/dist;
    client_max_body_size 20m;   # grosses playlists importées

    location /api/ {
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/wavify/backend/public/index.php;
    }

    location = /sw.js { add_header Cache-Control "no-cache"; }
    location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
    location / { try_files $uri /index.html; }
}
```

HTTPS avec `certbot --nginx -d music.lleroy.fr`. Côté PHP, `post_max_size` à 20M pour les playlists de plusieurs milliers de titres.

Variables facultatives du `.env` Laravel :
- `YOUTUBE_API_KEY` : utilise l'API officielle YouTube Data v3 (10 000 unités/jour, 100 par recherche).
- `SOUNDCLOUD_CLIENT_ID` : force un client_id SoundCloud.
- `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET` : import Spotify complet, sans limite de titres.

## Importer une playlist de plus de 100 titres

Sans clé, Spotify ne montre que les 100 premiers titres d'une playlist. Deux solutions :

**1. Clés Spotify (recommandé, une seule fois)**
1. Va sur https://developer.spotify.com/dashboard et clique sur « Create app ».
2. Mets n'importe quel nom, coche « Web API », et indique `http://127.0.0.1:5173` comme Redirect URI.
3. Colle le Client ID et le Client Secret dans `backend/.env`.
4. Relance `php artisan serve`. La page d'import affiche « API Spotify active ».

Les playlists éditoriales de Spotify (« Today's Top Hits »…) peuvent rester bloquées par l'API : l'app retombe alors sur les 100 premiers titres.

**2. Fichier CSV (sans clé)**
Exporte la playlist sur https://exportify.net puis utilise « Importer un fichier CSV » sur la page d'import.

Compte environ 2 à 3 minutes pour 1 000 titres : chaque titre est cherché sur la source choisie.

## Limites à connaître

- **Lecture en arrière-plan** : seul Audius (audio HTML5) continue de façon fiable écran verrouillé. YouTube et SoundCloud passent par leurs lecteurs intégrés officiels, que iOS met en pause quand l'app passe en arrière-plan. Android/Chrome est plus permissif.
- **iOS et le premier lancement YouTube** : si un titre YouTube ne démarre pas, ouvre le lecteur plein écran et touche la vidéo une fois.
- Certaines vidéos YouTube interdisent la lecture intégrée : l'app passe alors au titre suivant.
- **Import Spotify** : playlists et albums publics uniquement. Sans clé, 100 titres maximum (voir plus haut). La correspondance est automatique, les titres non trouvés ont un bouton « Chercher ».
- Les endpoints non officiels (InnerTube, api-v2 SoundCloud, embed Spotify) peuvent changer sans préavis. Tout est centralisé dans `backend/app/Services/MusicSources.php`.
- Usage personnel : respecte les conditions d'utilisation de chaque plateforme.
