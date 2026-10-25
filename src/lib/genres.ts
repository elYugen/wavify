import { Coffee, Flame, Guitar, Dumbbell, Moon, Music2, Piano, Sun, Waves, Zap, Heart, Palmtree, type LucideIcon } from 'lucide-react';

export const GENRES: { label: string; q: string; from: string; to: string; icon: LucideIcon }[] = [
  { label: 'Rap FR', q: 'rap français 2026', from: '#ff4d6d', to: '#ff9e3d', icon: Flame },
  { label: 'Lo-fi', q: 'lofi hip hop beats', from: '#8b7bff', to: '#c9a7ff', icon: Coffee },
  { label: 'Électro', q: 'electro house mix', from: '#2ee6d6', to: '#3d7bff', icon: Zap },
  { label: 'Afro', q: 'afrobeats', from: '#ffb547', to: '#ff6a3d', icon: Sun },
  { label: 'Chill', q: 'chill vibes', from: '#4fd1c5', to: '#6b8cff', icon: Waves },
  { label: 'Rock', q: 'rock classics', from: '#ff6a3d', to: '#b5179e', icon: Guitar },
  { label: 'Nuit', q: 'late night rnb', from: '#5b4bff', to: '#1f1b4d', icon: Moon },
  { label: 'Jazz', q: 'jazz classics', from: '#e6b980', to: '#a1672a', icon: Music2 },
  { label: 'Sport', q: 'workout motivation music', from: '#a3ff5c', to: '#2fbf71', icon: Dumbbell },
  { label: 'Classique', q: 'musique classique', from: '#d4c4a8', to: '#7d6b52', icon: Piano },
  { label: 'Love', q: 'love songs', from: '#ff7eb3', to: '#ff4d6d', icon: Heart },
  { label: 'Été', q: 'reggaeton summer hits', from: '#ffd166', to: '#06d6a0', icon: Palmtree },
];
