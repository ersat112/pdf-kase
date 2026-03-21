import { appRuntime } from '../../config/runtime';
import { authRemoteRuntimeConfig } from '../auth/auth-remote-config.service';

export type WorkspaceSyncRemoteRuntimeConfig = {
  provider: typeof appRuntime.authProvider;
  baseUrl: string | null;
  preflightPath: string;
  pushPath: string;
  pullPath: string;
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

export const workspaceSyncRemoteRuntimeConfig =
  Object.freeze<WorkspaceSyncRemoteRuntimeConfig>({
    provider: appRuntime.authProvider,
    baseUrl:
      normalizeBaseUrl(process.env.EXPO_PUBLIC_SYNC_API_BASE_URL) ??
      authRemoteRuntimeConfig.baseUrl,
    preflightPath: normalizePath(
      process.env.EXPO_PUBLIC_SYNC_PREFLIGHT_PATH,
      '/sync/workspaces/preflight',
    ),
    pushPath: normalizePath(
      process.env.EXPO_PUBLIC_SYNC_PUSH_PATH,
      '/sync/workspaces/push',
    ),
    pullPath: normalizePath(
      process.env.EXPO_PUBLIC_SYNC_PULL_PATH,
      '/sync/workspaces/pull',
    ),
    requestTimeoutMs: normalizeTimeout(
      process.env.EXPO_PUBLIC_SYNC_REQUEST_TIMEOUT_MS,
      authRemoteRuntimeConfig.requestTimeoutMs,
    ),
  });

export function isCustomWorkspaceSyncConfigured() {
  return (
    appRuntime.authProvider === 'custom' &&
    Boolean(workspaceSyncRemoteRuntimeConfig.baseUrl)
  );
}

export function getWorkspaceSyncRemoteRuntimeStatusLabel() {
  if (appRuntime.authProvider !== 'custom') {
    return 'Uzak sync devre dışı';
  }

  return workspaceSyncRemoteRuntimeConfig.baseUrl
    ? 'Custom sync yapılandırıldı'
    : 'Custom sync eksik';
}
