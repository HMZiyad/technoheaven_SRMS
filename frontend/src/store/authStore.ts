import { create } from 'zustand';
import { api } from '../api/client';
import { AuthUser } from '../types';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
}

const TOKEN_KEY = 'auth_token';

function getPersistedToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token');
}

function persistToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('token');
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: getPersistedToken(),
  status: 'idle',
  error: null,

  login: async (email: string, password: string) => {
    set({ status: 'loading', error: null });
    try {
      const response = await api.post<{ data: { user: AuthUser; token: string } }>(
        '/auth/login',
        { email, password }
      );
      const { user, token } = response.data;
      persistToken(token);
      set({ user, token, status: 'authenticated', error: null });
    } catch (err: any) {
      persistToken(null);
      set({ user: null, token: null, status: 'unauthenticated', error: err?.message || 'Login failed' });
      throw err;
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ status: 'loading', error: null });
    try {
      const response = await api.post<{ data: { user: AuthUser; token: string } }>(
        '/auth/register',
        { name, email, password }
      );
      const { user, token } = response.data;
      persistToken(token);
      set({ user, token, status: 'authenticated', error: null });
    } catch (err: any) {
      persistToken(null);
      set({ user: null, token: null, status: 'unauthenticated', error: err?.message || 'Registration failed' });
      throw err;
    }
  },

  logout: async () => {
    const { token } = get();
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch {
      // Ignore network or token expiration errors on logout
    } finally {
      persistToken(null);
      set({ user: null, token: null, status: 'unauthenticated', error: null });
    }
  },

  restoreSession: async () => {
    const token = getPersistedToken();
    if (!token) {
      set({ user: null, token: null, status: 'unauthenticated', error: null });
      return;
    }

    set({ token, status: 'loading', error: null });
    try {
      const response = await api.get<{ data: { user: AuthUser } }>('/auth/me', { token });
      set({ user: response.data.user, token, status: 'authenticated', error: null });
    } catch {
      persistToken(null);
      set({ user: null, token: null, status: 'unauthenticated', error: null });
    }
  },

  setUser: (user: AuthUser | null) => set({ user }),
  setToken: (token: string | null) => {
    persistToken(token);
    set({ token });
  },
}));

export default useAuthStore;
