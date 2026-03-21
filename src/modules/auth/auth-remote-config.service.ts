import { appRuntime } from '../../config/runtime';

export type AuthRemoteRuntimeConfig = {
  provider: typeof appRuntime.authProvider;
  baseUrl: string | null;
  loginPath: string;
  registerPath: string;
  sessionPath: string;
  logoutPath: string;
  switchWorkspacePath: string;
  requestTimeoutMs: number;
};

function normalizeBaseUrl(value: string | undefined) {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return null;
  }

  return normalized.replace(/\/+$/, '');
}

function normalizePath(value: string | undefined, fallback: string) {
  const normalized = value?.trim() ?? fallback;

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (!normalized.startsWith('/')) {
    return `/${normalized}`;
  }

  return normalized;
}

function normalizeTimeout(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1_500, Math.min(30_000, Math.trunc(parsed)));
}

export const authRemoteRuntimeConfig = Object.freeze<AuthRemoteRuntimeConfig>({
  provider: appRuntime.authProvider,
  baseUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_AUTH_API_BASE_URL),
  loginPath: normalizePath(process.env.EXPO_PUBLIC_AUTH_LOGIN_PATH, '/auth/login'),
  registerPath: normalizePath(
    process.env.EXPO_PUBLIC_AUTH_REGISTER_PATH,
    '/auth/register',
  ),
  sessionPath: normalizePath(process.env.EXPO_PUBLIC_AUTH_SESSION_PATH, '/auth/session'),
  logoutPath: normalizePath(process.env.EXPO_PUBLIC_AUTH_LOGOUT_PATH, '/auth/logout'),
  switchWorkspacePath: normalizePath(
    process.env.EXPO_PUBLIC_AUTH_SWITCH_WORKSPACE_PATH,
    '/auth/workspaces/switch',
  ),
  requestTimeoutMs: normalizeTimeout(
    process.env.EXPO_PUBLIC_AUTH_REQUEST_TIMEOUT_MS,
    12_000,
  ),
});

export function isCustomAuthRuntimeConfigured() {
  return appRuntime.authProvider === 'custom' && Boolean(authRemoteRuntimeConfig.baseUrl);
}

export function getAuthRemoteRuntimeStatusLabel() {
  if (appRuntime.authProvider !== 'custom') {
    return 'Uzak auth devre dışı';
  }

  return authRemoteRuntimeConfig.baseUrl
    ? 'Custom API yapılandırıldı'
    : 'Custom API eksik';
}

