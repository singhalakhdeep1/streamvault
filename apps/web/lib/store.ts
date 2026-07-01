import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';

interface User {
    id: string;
    email: string;
    username: string;
    avatarUrl?: string;
    role: string;
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: { email: string; password: string; username: string }) => Promise<void>;
    logout: () => Promise<void>;
    fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            isLoading: false,

            login: async (email, password) => {
                set({ isLoading: true });
                try {
                    const { data } = await api.post('/auth/login', { email, password });
                    const { user, accessToken, refreshToken } = data.data;
                    localStorage.setItem('access_token', accessToken);
                    localStorage.setItem('refresh_token', refreshToken);
                    set({ user, accessToken, isLoading: false });
                } catch (err) {
                    set({ isLoading: false });
                    throw err;
                }
            },

            register: async (payload) => {
                set({ isLoading: true });
                try {
                    const { data } = await api.post('/auth/register', payload);
                    const { user, accessToken, refreshToken } = data.data;
                    localStorage.setItem('access_token', accessToken);
                    localStorage.setItem('refresh_token', refreshToken);
                    set({ user, accessToken, isLoading: false });
                } catch (err) {
                    set({ isLoading: false });
                    throw err;
                }
            },

            logout: async () => {
                try { await api.post('/auth/logout'); } catch { }
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                set({ user: null, accessToken: null });
            },

            fetchMe: async () => {
                try {
                    const { data } = await api.get('/auth/me');
                    set({ user: data.data });
                } catch {
                    set({ user: null, accessToken: null });
                }
            },
        }),
        {
            name: 'streamvault-auth',
            partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
        },
    ),
);
