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
}

export interface SpotifyImport {
  kind: 'playlist' | 'album';
  id: string;
  name: string;
  owner: string;
  cover: string;
  tracks: { title: string; artist: string; duration: number }[];
}
