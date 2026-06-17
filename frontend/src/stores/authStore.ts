import { create } from 'zustand';
import { AuthUser } from '../types';
import { authApi, getToken, setToken } from '../api/client';
import { getErrorMessage } from '../utils';

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restore: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: getToken(),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await authApi.login(email, password);
      setToken(data.token);
      set({ user: data.user, token: data.token, loading: false });
    } catch (e) {
      set({ error: getErrorMessage(e, 'Login failed'), loading: false });
      throw e;
    }
  },

  register: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await authApi.register(email, password);
      setToken(data.token);
      set({ user: data.user, token: data.token, loading: false });
    } catch (e) {
      set({ error: getErrorMessage(e, 'Registration failed'), loading: false });
      throw e;
    }
  },

  logout: () => {
    setToken(null);
    set({ user: null, token: null });
  },

  // On page load, if we still hold a token, confirm it's valid.
  restore: async () => {
    if (!getToken()) return;
    try {
      const data = await authApi.me();
      set({ user: data.user, token: getToken() });
    } catch {
      setToken(null);
      set({ user: null, token: null });
    }
  },
}));
