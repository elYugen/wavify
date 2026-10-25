export type Source = 'youtube' | 'soundcloud' | 'audius';

export interface Track {
  id: string; // `${source}:${sourceId}`
  source: Source;
  sourceId: string;
  title: string;
  artist: string;
  duration: number; // secondes
  artwork: string;
  url: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
  playedAt?: number;
  cover?: string;
  importedFrom?: string;
  screenOff?: boolean; // YouTube via yt-dlp : lecture écran éteint, démarrage plus lent
  shareToken?: string; // lien public /s/{token} (fixé par le serveur)
  isPublic?: boolean; // affichée sur le profil
}

/** Profil visible par tous (/u/{handle}). */
export interface PublicUser {
  handle: string;
  name: string;
  bio: string;
  avatar: string | null;
  banner: string | null;
}

export interface PublicProfile extends PublicUser {
  playlists: { token: string; name: string; cover?: string; artworks: string[]; trackCount: number; updatedAt: number }[];
}

/** Playlist ouverte depuis un lien de partage. */
export interface SharedPlaylist {
  token: string;
  name: string;
  description: string;
  cover?: string;
  tracks: Track[];
  owner: string;
  ownerHandle: string;
  ownerAvatar: string | null;
  updatedAt: number;
}

export interface SpotifyImport {
  kind: 'playlist' | 'album';
  id: string;
  name: string;
  owner: string;
  cover: string;
  tracks: { title: string; artist: string; duration: number }[];
  via?: 'api' | 'embed' | 'csv';
  limited?: boolean; // liste tronquée à 100 titres
  apiError?: string;
}
