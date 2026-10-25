import { create } from 'zustand';
import type { Track } from '../types';

interface UiState {
  addTo: Track[] | null; // feuille "Ajouter à une playlist"
  menu: { track: Track; playlistId?: string } | null; // menu d'actions d'un titre
  createOpen: boolean;
  createWith: Track[]; // titres à ajouter après création
  openAddTo: (tracks: Track[]) => void;
  openMenu: (track: Track, playlistId?: string) => void;
  openCreate: (withTracks?: Track[]) => void;
  close: () => void;
}

export const useUi = create<UiState>((set) => ({
  addTo: null,
  menu: null,
  createOpen: false,
  createWith: [],
  openAddTo: (tracks) => set({ addTo: tracks, menu: null }),
  openMenu: (track, playlistId) => set({ menu: { track, playlistId } }),
  openCreate: (withTracks = []) => set({ createOpen: true, createWith: withTracks, addTo: null, menu: null }),
  close: () => set({ addTo: null, menu: null, createOpen: false, createWith: [] }),
}));
