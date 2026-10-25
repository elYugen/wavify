import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { request, setAuthToken } from '../lib/api';
import type { PublicUser } from '../types';

export interface User extends PublicUser {
  id: number;
  email: string;
}

interface Session {
  token: string;
  user: User;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  /** Recharge le profil du compte (autre appareil, migration des anciens comptes…). */
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'handle' | 'bio'>>) => Promise<void>;
  /** Envoie (data URL) ou retire (null) la photo de profil ou la bannière. */
  setImage: (kind: 'avatar' | 'banner', image: string | null) => Promise<void>;
  /** Oublie la session localement (le jeton côté serveur est révoqué par logout()). */
  clear: () => void;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      login: async (email, password) => {
        const s = await request<Session>('POST', '/api/auth/login', { email, password });
        set({ token: s.token, user: s.user });
      },

      register: async (name, email, password) => {
        const s = await request<Session>('POST', '/api/auth/register', { name, email, password });
        set({ token: s.token, user: s.user });
      },

      refresh: async () => {
        if (!get().token) return;
        try {
          set({ user: (await request<{ user: User }>('GET', '/api/auth/me')).user });
        } catch (e: any) {
          if (e?.status === 401) get().clear();
        }
      },

      updateProfile: async (patch) => {
        set({ user: (await request<{ user: User }>('PUT', '/api/profile', patch)).user });
      },

      setImage: async (kind, image) => {
        set({ user: (await request<{ user: User }>('POST', `/api/profile/${kind}`, { image })).user });
      },

      clear: () => set({ token: null, user: null }),

      logout: async () => {
        if (!get().token) return;
        try {
          await request('POST', '/api/auth/logout');
        } catch {
          /* hors ligne : le jeton expirera côté serveur */
        }
        get().clear();
      },
    }),
    { name: 'wavify-auth', version: 1 },
  ),
);

// Le client API suit le jeton courant (y compris celui restauré du localStorage).
setAuthToken(useAuth.getState().token);
useAuth.subscribe((s) => setAuthToken(s.token));
