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
| Import Spotify | Page « embed » publique de la playlist ou de l'album | Non |

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

## Limites à connaître

- **Lecture en arrière-plan** : seul Audius (audio HTML5) continue de façon fiable écran verrouillé. YouTube et SoundCloud passent par leurs lecteurs intégrés officiels, que iOS met en pause quand l'app passe en arrière-plan. Android/Chrome est plus permissif.
- **iOS et le premier lancement YouTube** : si un titre YouTube ne démarre pas, ouvre le lecteur plein écran et touche la vidéo une fois.
- Certaines vidéos YouTube interdisent la lecture intégrée : l'app passe alors au titre suivant.
- **Import Spotify** : playlists et albums publics uniquement, 100 titres maximum (limite de la page embed). La correspondance est automatique, les titres non trouvés ont un bouton « Chercher ».
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
