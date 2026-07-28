import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import api from '@/lib/api';
import { User } from '@/types';
import { disconnectAll } from '@/lib/socket';
import { trackLogin, trackLogout, trackRegistration } from '@/lib/analytics/events';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; region?: string }) => Promise<{ message: string; email: string }>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  updateUser: (data: Partial<User>) => void;
  fetchMe: () => Promise<void>;
  setHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
          Cookies.set('accessToken', data.accessToken, { expires: 1 / 96, secure: isSecure, sameSite: 'lax' });
          Cookies.set('refreshToken', data.refreshToken, { expires: 7, secure: isSecure, sameSite: 'lax' });
          set({
            user: data.user,
            accessToken: data.accessToken,
            isAuthenticated: true,
          });
          trackLogin({ method: 'email', userId: data.user?.id });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (data) => {
        const response = await api.post('/auth/register', data);
        return response.data; // { message, email }
      },

      verifyOtp: async (email, otp) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/verify-otp', { email, otp });
          const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
          Cookies.set('accessToken', data.accessToken, { expires: 1 / 96, secure: isSecure, sameSite: 'lax' });
          Cookies.set('refreshToken', data.refreshToken, { expires: 7, secure: isSecure, sameSite: 'lax' });
          set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
          // OTP verification is the moment the account actually becomes active — the real "registration complete" event.
          trackRegistration({ userId: data.user?.id });
        } finally {
          set({ isLoading: false });
        }
      },

      resendOtp: async (email) => {
        const response = await api.post('/auth/resend-otp', { email });
        return response.data; // { message }
      },

      logout: async () => {
        trackLogout();
        try {
          await api.post('/auth/logout');
        } catch {}
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
        disconnectAll();
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user, isAuthenticated: true }),

      updateUser: (data) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...data } });
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get('/users/me');
          set({ user: data, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },

      setHydrated: (v) => set({ isHydrated: v }),
    }),
    {
      name: 'auth-storage',
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        // isHydrated intentionally excluded — always resets to false on mount
      }),
    },
  ),
);
