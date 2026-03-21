// src/store/useAuthStore.ts
import { create } from 'zustand';

import {
  hydrateAuthSession,
  loginWithPassword,
  logoutCurrentSession,
  refreshStoredSessionWorkspaceContext,
  registerWithPassword,
  switchStoredSessionWorkspace,
  type AuthSession,
} from '../modules/auth/auth.service';
import {
  captureObservabilityError,
  trackObservabilityEvent,
} from '../modules/observability/observability.service';

export type AuthStatus = 'booting' | 'guest' | 'authenticated';

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

type AuthStore = {
  status: AuthStatus;
  session: AuthSession | null;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshWorkspaceContext: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  clearError: () => void;
};

function validateEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

function validateLoginPassword(password: string) {
  return password.trim().length >= 6;
}

function validateStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    /[a-zçğıöşü]/.test(password) &&
    /[A-ZÇĞİÖŞÜ]/.test(password) &&
    /\d/.test(password)
  );
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 120);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: 'booting',
  session: null,
  error: null,

  hydrate: async () => {
    try {
      set({ status: 'booting', error: null });

      const session = await hydrateAuthSession();

      if (session) {
        void trackObservabilityEvent({
          feature: 'auth',
          name: 'session_hydrated',
          source: 'auth_store',
          metadata: {
            workspaceCount: session.workspaces.length,
            activeWorkspaceId: session.activeWorkspaceId,
          },
        });
        set({
          status: 'authenticated',
          session,
          error: null,
        });
        return;
      }

      set({
        status: 'guest',
        session: null,
        error: null,
      });
    } catch (error) {
      console.warn('[AuthStore] Hydration failed:', error);
      void captureObservabilityError({
        feature: 'auth',
        name: 'session_hydration_failed',
        source: 'auth_store',
        error,
      });

      set({
        status: 'guest',
        session: null,
        error: null,
      });
    }
  },

  login: async ({ email, password }) => {
    try {
      set({ error: null });

      const normalizedEmail = email.trim().toLowerCase();

      if (!validateEmail(normalizedEmail)) {
        throw new Error('Geçerli bir e-posta adresi gir.');
      }

      if (!validateLoginPassword(password)) {
        throw new Error('Şifre en az 6 karakter olmalı.');
      }

      const session = await loginWithPassword({
        email: normalizedEmail,
        password,
      });

      void trackObservabilityEvent({
        feature: 'auth',
        name: 'login_succeeded',
        source: 'auth_store',
        metadata: {
          workspaceCount: session.workspaces.length,
          activeWorkspaceId: session.activeWorkspaceId,
        },
      });

      set({
        status: 'authenticated',
        session,
        error: null,
      });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Giriş yapılırken beklenmeyen bir hata oluştu.',
      );

      void captureObservabilityError({
        feature: 'auth',
        name: 'login_failed',
        source: 'auth_store',
        error,
      });
      set({ error: message });
      throw new Error(message);
    }
  },

  register: async ({ name, email, password, passwordConfirm }) => {
    try {
      set({ error: null });

      const normalizedName = normalizeName(name);
      const normalizedEmail = email.trim().toLowerCase();

      if (normalizedName.length < 3) {
        throw new Error('Ad soyad en az 3 karakter olmalı.');
      }

      if (!validateEmail(normalizedEmail)) {
        throw new Error('Geçerli bir e-posta adresi gir.');
      }

      if (!validateStrongPassword(password)) {
        throw new Error(
          'Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.',
        );
      }

      if (password !== passwordConfirm) {
        throw new Error('Şifreler aynı değil.');
      }

      const session = await registerWithPassword({
        name: normalizedName,
        email: normalizedEmail,
        password,
      });

      void trackObservabilityEvent({
        feature: 'auth',
        name: 'register_succeeded',
        source: 'auth_store',
        metadata: {
          workspaceCount: session.workspaces.length,
          activeWorkspaceId: session.activeWorkspaceId,
        },
      });

      set({
        status: 'authenticated',
        session,
        error: null,
      });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Kayıt oluşturulurken beklenmeyen bir hata oluştu.',
      );

      void captureObservabilityError({
        feature: 'auth',
        name: 'register_failed',
        source: 'auth_store',
        error,
      });
      set({ error: message });
      throw new Error(message);
    }
  },

    logout: async () => {
      try {
        const previousSession = get().session;
        await logoutCurrentSession(get().session);

        void trackObservabilityEvent({
          feature: 'auth',
          name: 'logout_succeeded',
          source: 'auth_store',
          metadata: {
            activeWorkspaceId: previousSession?.activeWorkspaceId ?? null,
          },
        });

        set({
          status: 'guest',
        session: null,
        error: null,
      });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Çıkış yapılırken beklenmeyen bir hata oluştu.',
      );

      void captureObservabilityError({
        feature: 'auth',
        name: 'logout_failed',
        source: 'auth_store',
        error,
      });
      set({ error: message });
      throw new Error(message);
    }
  },

  refreshWorkspaceContext: async () => {
    try {
      const currentSession = get().session;

      if (!currentSession) {
        return;
      }

      const nextSession = await refreshStoredSessionWorkspaceContext(currentSession);

      if (!nextSession) {
        set({
          status: 'guest',
          session: null,
          error: null,
        });
        return;
      }

      void trackObservabilityEvent({
        feature: 'auth',
        name: 'workspace_context_refreshed',
        source: 'auth_store',
        metadata: {
          workspaceCount: nextSession.workspaces.length,
          activeWorkspaceId: nextSession.activeWorkspaceId,
        },
      });

      set({
        status: 'authenticated',
        session: nextSession,
        error: null,
      });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Çalışma alanı bilgisi güncellenirken beklenmeyen bir hata oluştu.',
      );

      void captureObservabilityError({
        feature: 'auth',
        name: 'workspace_context_refresh_failed',
        source: 'auth_store',
        error,
      });
      set({ error: message });
      throw new Error(message);
    }
  },

  switchWorkspace: async (workspaceId: string) => {
    try {
      const currentSession = get().session;

      if (!currentSession) {
        throw new Error('Önce oturum açmalısın.');
      }

      const nextSession = await switchStoredSessionWorkspace({
        session: currentSession,
        workspaceId,
      });

      void trackObservabilityEvent({
        feature: 'auth',
        name: 'workspace_switched',
        source: 'auth_store',
        metadata: {
          workspaceId,
          workspaceCount: nextSession.workspaces.length,
        },
      });

      set({
        status: 'authenticated',
        session: nextSession,
        error: null,
      });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Çalışma alanı değiştirilirken beklenmeyen bir hata oluştu.',
      );

      void captureObservabilityError({
        feature: 'auth',
        name: 'workspace_switch_failed',
        source: 'auth_store',
        error,
        metadata: {
          workspaceId,
        },
      });
      set({ error: message });
      throw new Error(message);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
