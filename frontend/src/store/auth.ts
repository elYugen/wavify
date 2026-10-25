import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { request, setAuthToken } from '../lib/api';

export interface User {
  id: number;
  name: string;
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
