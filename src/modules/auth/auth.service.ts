// src/modules/auth/auth.service.ts
import * as SecureStore from 'expo-secure-store';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

const AUTH_SESSION_KEY = 'pdf-kase.auth.session.v1';

function generateMockToken(email: string) {
  const randomPart = Math.random().toString(36).slice(2);
  return `mock_${email.replace(/[^a-z0-9]/gi, '')}_${Date.now()}_${randomPart}`;
}

function normalizeName(inputName: string | undefined, email: string) {
  const fallback =
    email.split('@')[0]?.replace(/[^a-z0-9]/gi, ' ')?.trim() || 'Kullanici';

  const normalized = inputName?.trim();

  return normalized && normalized.length >= 2 ? normalized : fallback;
}

function isValidSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<AuthSession>;

  return Boolean(
    typeof session.accessToken === 'string' &&
      session.accessToken.length > 0 &&
      session.user &&
      typeof session.user.id === 'string' &&
      session.user.id.length > 0 &&
      typeof session.user.name === 'string' &&
      session.user.name.length > 0 &&
      typeof session.user.email === 'string' &&
      session.user.email.length > 0,
  );
}

export async function getStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!isValidSession(parsed)) {
      await clearStoredSession();
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[AuthService] Failed to read session:', error);
    return null;
  }
}

export async function setStoredSession(session: AuthSession) {
  await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}

export async function createLocalSession(input: {
  name?: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  const email = input.email.trim().toLowerCase();

  if (!email) {
    throw new Error('E-posta zorunludur.');
  }

  if (!input.password.trim()) {
    throw new Error('Şifre zorunludur.');
  }

  const name = normalizeName(input.name, email);

  return {
    accessToken: generateMockToken(email),
    user: {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      email,
    },
  };
}