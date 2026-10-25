# Wavify

Clone de Spotify en **React + TypeScript + Tailwind CSS 4**, installable en **PWA** sur smartphone.
Il cherche et lit de la musique gratuite depuis **YouTube**, **SoundCloud** et **Audius**, gère des playlists et importe des playlists **Spotify**.

## Lancer en local

```bash
npm install
npm run dev
```

L'app est sur http://localhost:5173. Le serveur écoute aussi sur le réseau local : ouvre l'adresse « Network » affichée par Vite depuis ton téléphone (même Wi-Fi).

> L'installation PWA (« Ajouter à l'écran d'accueil ») exige HTTPS. En local sur le téléphone, l'app fonctionne mais ne s'installe pas. Déploie-la (voir plus bas) pour l'installer.

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

Le petit backend est dans [server/api.js](server/api.js). Il sert à contourner le CORS des navigateurs. Il tourne :
- dans Vite en dev (plugin dans `vite.config.ts`) ;
- en fonctions serverless Vercel (`api/`) ;
- ou en serveur Node autonome (`npm run build && npm start`, port 3000).

Les playlists, titres likés et l'historique sont stockés dans le `localStorage` du navigateur.

## Déployer (pour installer la PWA)

**Vercel** : `npx vercel` à la racine du projet. Les routes `/api/*` et la réécriture SPA sont déjà configurées.

**Serveur perso** : `npm run build && PORT=3000 npm start`, derrière un reverse proxy HTTPS (Caddy, Nginx…).

Variables d'environnement facultatives :
- `YOUTUBE_API_KEY` : utilise l'API officielle YouTube Data v3 (10 000 unités/jour, 100 par recherche).
- `SOUNDCLOUD_CLIENT_ID` : force un client_id SoundCloud.
- `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET` : import Spotify complet, sans limite de titres.

## Importer une playlist de plus de 100 titres

Sans clé, Spotify ne montre que les 100 premiers titres d'une playlist. Deux solutions :

**1. Clés Spotify (recommandé, une seule fois)**
1. Va sur https://developer.spotify.com/dashboard et clique sur « Create app ».
2. Mets n'importe quel nom, coche « Web API », et indique `http://127.0.0.1:5173` comme Redirect URI.
3. Copie `.env.example` en `.env` et colle le Client ID et le Client Secret.
4. Relance `npm run dev`. La page d'import affiche « API Spotify active ».

Sur Vercel, ajoute les deux variables dans Settings › Environment Variables. Les playlists éditoriales de Spotify (« Today's Top Hits »…) peuvent rester bloquées par l'API : l'app retombe alors sur les 100 premiers titres.

**2. Fichier CSV (sans clé)**
Exporte la playlist sur https://exportify.net puis utilise « Importer un fichier CSV » sur la page d'import.

Compte environ 2 à 3 minutes pour 1 000 titres : chaque titre est cherché sur la source choisie.

## Limites à connaître

- **Lecture en arrière-plan** : seul Audius (audio HTML5) continue de façon fiable écran verrouillé. YouTube et SoundCloud passent par leurs lecteurs intégrés officiels, que iOS met en pause quand l'app passe en arrière-plan. Android/Chrome est plus permissif.
- **iOS et le premier lancement YouTube** : si un titre YouTube ne démarre pas, ouvre le lecteur plein écran et touche la vidéo une fois.
- Certaines vidéos YouTube interdisent la lecture intégrée : l'app passe alors au titre suivant.
- **Import Spotify** : playlists et albums publics uniquement. Sans clé, 100 titres maximum (voir plus haut). La correspondance est automatique, les titres non trouvés ont un bouton « Chercher ».
- Les endpoints non officiels (InnerTube, api-v2 SoundCloud, embed Spotify) peuvent changer sans préavis. Tout est centralisé dans `server/api.js`.
- Usage personnel : respecte les conditions d'utilisation de chaque plateforme.

## Structure

```
server/api.js          backend (recherche, import Spotify)
api/*.js               fonctions Vercel
src/player/engine.ts   moteur de lecture (audio, YouTube, SoundCloud) + Media Session
src/store/             état : bibliothèque (persistée), lecteur, UI, toasts
src/pages/             Accueil, Recherche, Bibliothèque, Playlist, Import
src/components/        lecteur, feuilles d'actions, pochettes…
```
