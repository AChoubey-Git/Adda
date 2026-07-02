import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { initE2E, teardownE2E } from '../services/e2eManager';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user:            null,
      accessToken:     null,
      refreshToken:    null,
      isAuthenticated: false,
      isLoading:       false,
      e2eReady:        false,  // true once key pair is initialised
      e2eEnabled:      true,   // user toggle — persisted

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          set({
            user:            data.user,
            accessToken:     data.accessToken,
            refreshToken:    data.refreshToken,
            isAuthenticated: true,
          });

          // ✅ Initialise E2E key pair after login
          const userId = data.user._id || data.user.id;
          const ready  = await initE2E(userId);
          set({ e2eReady: ready });

          return data;
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/register', { name, email, password });
          const data = response.data;

          // Guard: server returned empty/no-content response (should not happen, but be safe)
          if (!data || !data.user) {
            const status = response.status;
            throw new Error(`Registration failed: server returned status ${status} with no user data`);
          }

          set({
            user:            data.user,
            accessToken:     data.accessToken,
            refreshToken:    data.refreshToken,
            isAuthenticated: true,
          });

          // ✅ Generate fresh key pair for new user
          const userId = data.user._id || data.user.id;
          const ready  = await initE2E(userId);
          set({ e2eReady: ready });

          return data;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch {}
        teardownE2E(); // wipe in-memory key cache
        set({
          user:            null,
          accessToken:     null,
          refreshToken:    null,
          isAuthenticated: false,
          e2eReady:        false,
          e2eEnabled:      true,  // reset to default on logout
        });
      },

      toggleE2E: () =>
        set((state) => ({ e2eEnabled: !state.e2eEnabled })),

      refreshTokens: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;
        try {
          const { data } = await api.post('/auth/refresh', {}, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
          return data.accessToken;
        } catch {
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        }
      },

      // Re-init E2E if app reloaded while already authenticated
      ensureE2E: async () => {
        const { user, isAuthenticated, e2eReady } = get();
        if (isAuthenticated && !e2eReady && user) {
          const userId = user._id || user.id;
          const ready  = await initE2E(userId);
          set({ e2eReady: ready });
        }
      },

      updateUser: (updates) =>
        set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'adda-auth',
      partialize: (state) => ({
        user:            state.user,
        accessToken:     state.accessToken,
        refreshToken:    state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        e2eEnabled:      state.e2eEnabled,   // persisted — user preference
        // e2eReady is NOT persisted — re-checked on every app load
      }),
    },
  ),
);

export default useAuthStore;
