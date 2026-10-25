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

### Profils

Chaque compte a un profil public `https://music.lleroy.fr/u/pseudo` : photo, bannière, nom, pseudo, bio et playlists publiques. On le modifie depuis la page **Compte** (« Voir et modifier mon profil »). Les profils se trouvent dans **Explorer** (section « Profils ») et depuis le nom affiché sur une playlist partagée.

Une playlist devient publique avec « Afficher sur mon profil » dans sa fenêtre **Partager** (elle reçoit alors un lien de partage). Les images sont recadrées dans le navigateur (photo 400 × 400, bannière 1500 × 500), vérifiées par le serveur puis stockées dans `backend/storage/app/private/profiles` et servies par `/api/users/{pseudo}/avatar|banner`.

### Partage de playlists

Bouton **Partager** d'une playlist (compte requis) : crée un lien public `https://music.lleroy.fr/s/…`. Toute personne qui l'ouvre, même sans compte, peut écouter la playlist (toujours la dernière version) et l'ajouter à sa collection. « Arrêter le partage » rend le lien inutilisable ; supprimer la playlist aussi.

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
- `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET` : clés Spotify (voir plus bas).
- `YTDLP_BIN`, `YTDLP_ARGS`, `YTDLP_ENABLED` : lecture YouTube écran éteint (voir ci-dessous).

## Lecture YouTube écran éteint (yt-dlp)

Le lecteur YouTube intégré est mis en pause par YouTube et par iOS dès que l'écran s'éteint.
Si [yt-dlp](https://github.com/yt-dlp/yt-dlp) est installé sur le serveur, Wavify lit YouTube autrement :

1. le serveur demande à yt-dlp l'adresse du flux audio de la vidéo (AAC/m4a, lisible sur iPhone) ;
2. il relaie ce flux à l'app (`/api/stream/youtube/{id}`), par tranches de 2 Mo, en gérant l'avance rapide ;
3. l'app le joue avec un simple lecteur audio, comme Audius : la lecture continue écran verrouillé et enchaîne les titres.

Ce mode s'active **playlist par playlist** avec le bouton **Écran coupé** (lune) de la page playlist, aussi pour les coups de cœur. Ailleurs, YouTube garde le lecteur intégré, qui démarre tout de suite : la résolution d'un titre par yt-dlp prend quelques secondes. Le bouton n'apparaît que si yt-dlp est disponible sur le serveur.

L'adresse du flux contient l'IP qui l'a demandée : c'est donc forcément le serveur qui relaie le son (yt-dlp et le relais sortent tous les deux en IPv4).
Si le flux échoue pour une vidéo, l'app reprend le lecteur YouTube intégré. Sans yt-dlp, rien ne change.

**Installation (Debian/Ubuntu)** :

```bash
# yt-dlp, version autonome (sans Python)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Deno : moteur JavaScript dont yt-dlp a besoin pour YouTube depuis fin 2025
sudo apt install -y unzip
curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -o /tmp/deno.zip
sudo unzip -o /tmp/deno.zip -d /usr/local/bin && sudo chmod a+rx /usr/local/bin/deno

# Test avec l'utilisateur de PHP-FPM : doit afficher une URL googlevideo.com, sans « WARNING »
sudo -u www-data /usr/local/bin/yt-dlp --force-ipv4 -f 140 -g "https://www.youtube.com/watch?v=FGBhQbmPwH8"
```

Dans `backend/.env` : `YTDLP_BIN=/usr/local/bin/yt-dlp` (chemin complet : PHP-FPM vide le `PATH`), puis `php artisan optimize`.
`https://music.lleroy.fr/api/stream/status` doit répondre `{"youtube":true}`.

**Mises à jour** : YouTube change souvent, yt-dlp aussi. Mets à jour chaque jour (crontab de root) :

```
0 4 * * * /usr/local/bin/yt-dlp -U >/dev/null 2>&1
```

**Si YouTube bloque le serveur** (« Sign in to confirm you're not a bot », fréquent sur les IP d'hébergeurs) :
- exporte les cookies d'un compte YouTube (de préférence secondaire) au format Netscape, place-les sur le serveur lisibles par `www-data`, et mets `YTDLP_ARGS=--cookies /chemin/cookies.txt` ;
- ou installe un fournisseur de « PO token » (voir le [guide yt-dlp](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)).

Les erreurs de yt-dlp sont dans `backend/storage/logs/laravel.log`.

Côté ressources : chaque titre lancé coûte une requête yt-dlp (environ 2 à 3 s, puis mise en cache jusqu'à expiration de l'adresse) et la bande passante du fichier audio (environ 4 Mo pour 4 minutes). Le titre suivant de la file est préparé à l'avance.

> Ce mode contourne le lecteur officiel : il est contraire aux conditions d'utilisation de YouTube. À réserver à un usage personnel. `YTDLP_ENABLED=false` le coupe.

## Importer une playlist de plus de 100 titres

Sans clé, Spotify ne montre que les 100 premiers titres d'une playlist. Deux solutions :

**1. « Connecter Spotify » (pour tes propres playlists)**
Depuis février 2026, l'API Spotify ne donne les titres d'une playlist qu'à son créateur ou ses collaborateurs, et le compte qui crée l'app doit être Premium.
1. Sur https://developer.spotify.com/dashboard, crée une app avec « Web API ».
2. Dans **Redirect URIs**, ajoute `https://music.lleroy.fr/api/spotify/callback` (en local : `http://127.0.0.1:5173/api/spotify/callback`, à mettre aussi dans `SPOTIFY_REDIRECT_URI`).
3. Dans **User Management**, ajoute le compte Spotify de chaque personne qui importera (5 maximum).
4. Colle le Client ID et le Client Secret dans `backend/.env`, puis `php artisan optimize`.
5. Sur la page d'import, touche **Connecter Spotify** : tes playlists s'importent alors en entier.

**2. Fichier CSV (pour toutes les playlists, sans clé)**
Exporte la playlist sur https://exportify.net puis utilise « Importer un fichier CSV » sur la page d'import. Le lien « Comment faire ? » de la page d'import détaille chaque étape.

Compte environ 2 à 3 minutes pour 1 000 titres : chaque titre est cherché sur la source choisie.

## Limites à connaître

- **Lecture en arrière-plan** : Audius, et YouTube si yt-dlp est installé sur le serveur (voir plus haut), continuent écran verrouillé. SoundCloud et YouTube sans yt-dlp passent par les lecteurs intégrés officiels, mis en pause quand l'app passe en arrière-plan.
- **iOS et le premier lancement YouTube** : si un titre YouTube ne démarre pas, ouvre le lecteur plein écran et touche la vidéo une fois.
- Certaines vidéos YouTube interdisent la lecture intégrée : l'app passe alors au titre suivant.
- **Import Spotify** : playlists et albums publics uniquement. Sans clé, 100 titres maximum (voir plus haut). La correspondance est automatique, les titres non trouvés ont un bouton « Chercher » qui ouvre une recherche et les ajoute à la playlist importée.
- Les endpoints non officiels (InnerTube, api-v2 SoundCloud, embed Spotify) peuvent changer sans préavis. Tout est centralisé dans `backend/app/Services/MusicSources.php`.
- Usage personnel : respecte les conditions d'utilisation de chaque plateforme.
