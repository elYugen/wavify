import type { Source } from '../types';

export const SOURCES: Record<Source, { label: string; color: string; hint: string }> = {
  youtube: { label: 'YouTube', color: '#ff0033', hint: 'Le plus grand catalogue' },
  soundcloud: { label: 'SoundCloud', color: '#ff5500', hint: 'Remixes, sons indé' },
  audius: { label: 'Audius', color: '#cc0fe0', hint: 'Lecture en arrière-plan' },
};

export const SOURCE_ORDER: Source[] = ['youtube', 'soundcloud', 'audius'];
