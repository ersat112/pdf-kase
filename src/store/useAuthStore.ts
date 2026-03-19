// src/store/useAuthStore.ts
import { create } from 'zustand';

import {
    clearStoredSession,
    createLocalSession,
    getStoredSession,
    setStoredSession,
    type AuthSession,
} from '../modules/auth/auth.service';

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
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'booting',
  session: null,
  error: null,

  hydrate: async () => {
    try {
      set({ status: 'booting', error: null });

      const session = await getStoredSession();

      if (session) {
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

      const session = await createLocalSession({
        email: normalizedEmail,
        password,
      });

      await setStoredSession(session);

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

      const session = await createLocalSession({
        name: normalizedName,
        email: normalizedEmail,
        password,
      });

      await setStoredSession(session);

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

      set({ error: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      await clearStoredSession();

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

      set({ error: message });
      throw new Error(message);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));