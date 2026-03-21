// src/modules/auth/auth.service.ts
import * as SecureStore from 'expo-secure-store';

import {
  appRuntime,
  getAuthRuntimeDisplayLabel,
} from '../../config/runtime';
import type { AuthProviderAdapter } from './auth-provider';
import { isCustomAuthRuntimeConfigured } from './auth-remote-config.service';
import { createCustomApiAuthProvider } from './providers/custom-api-auth.provider';
import { createPreviewLocalAuthProvider } from './providers/preview-local-auth.provider';
import { createRuntimeBridgeAuthProvider } from './providers/runtime-bridge-auth.provider';
import type {
  AuthLoginInput,
  AuthRegisterInput,
  AuthSession,
  AuthSessionMetadata,
  AuthWorkspace,
  AuthWorkspaceRole,
} from './auth.types';

export type {
  AuthLoginInput,
  AuthRegisterInput,
  AuthSession,
  AuthSessionMetadata,
  AuthSessionMode,
  AuthUser,
  AuthWorkspace,
  AuthWorkspaceRole,
  AuthWorkspaceSource,
} from './auth.types';

type LegacyAuthSessionMetadata = {
  authMode?: 'mock_local';
  provider?: 'local_mock';
  createdAt?: string;
  version?: 'v2';
};

const AUTH_SESSION_KEY = 'pdf-kase.auth.session.v1';

function isValidWorkspace(value: unknown): value is AuthWorkspace {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const workspace = value as Partial<AuthWorkspace>;

  return Boolean(
    typeof workspace.id === 'string' &&
      workspace.id.length > 0 &&
      typeof workspace.slug === 'string' &&
      workspace.slug.length > 0 &&
      typeof workspace.name === 'string' &&
      workspace.name.length > 0 &&
      (workspace.role === 'owner' ||
        workspace.role === 'admin' ||
        workspace.role === 'member' ||
        workspace.role === 'viewer') &&
      (workspace.source === 'personal' ||
        workspace.source === 'local_profile' ||
        workspace.source === 'remote') &&
      typeof workspace.isPersonal === 'boolean' &&
      typeof workspace.isDefault === 'boolean',
  );
}

function isValidSessionMetadata(value: unknown): value is AuthSessionMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const metadata = value as Partial<AuthSessionMetadata>;

  return Boolean(
    (metadata.authMode === 'preview_local' ||
      metadata.authMode === 'provider_bridge' ||
      metadata.authMode === 'provider_managed') &&
      typeof metadata.provider === 'string' &&
      metadata.provider.length > 0 &&
      metadata.version === 'v3' &&
      typeof metadata.createdAt === 'string' &&
      metadata.createdAt.trim().length > 0 &&
      typeof metadata.updatedAt === 'string' &&
      metadata.updatedAt.trim().length > 0 &&
      (metadata.workspaceContext === 'local_preview' ||
        metadata.workspaceContext === 'remote'),
  );
}

function isBaseSessionShape(value: unknown) {
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

function normalizeSessionMetadata(
  value: unknown,
): AuthSessionMetadata | null {
  if (isValidSessionMetadata(value)) {
    return value;
  }

  const legacyMetadata = (value ?? null) as LegacyAuthSessionMetadata | null;
  const now = new Date().toISOString();

  return {
    authMode:
      appRuntime.authProvider === 'preview_local'
        ? 'preview_local'
        : 'provider_bridge',
    provider: appRuntime.authProvider,
    createdAt:
      typeof legacyMetadata?.createdAt === 'string' &&
      legacyMetadata.createdAt.trim().length > 0
        ? legacyMetadata.createdAt
        : now,
    updatedAt: now,
    workspaceContext: 'local_preview',
    version: 'v3',
  };
}

function normalizeStoredSession(value: unknown): AuthSession | null {
  if (!isBaseSessionShape(value)) {
    return null;
  }

  const session = value as Partial<AuthSession>;
  const workspaces = Array.isArray(session.workspaces)
    ? session.workspaces.filter(isValidWorkspace)
    : [];
  const activeWorkspaceId =
    typeof session.activeWorkspaceId === 'string' &&
    session.activeWorkspaceId.trim().length > 0
      ? session.activeWorkspaceId
      : null;

  return {
    accessToken: session.accessToken as string,
    refreshToken:
      typeof session.refreshToken === 'string' &&
      session.refreshToken.trim().length > 0
        ? session.refreshToken
        : null,
    user: session.user as AuthSession['user'],
    workspaces,
    activeWorkspaceId,
    metadata: normalizeSessionMetadata(session.metadata),
  };
}

function getAuthProvider(): AuthProviderAdapter {
  switch (appRuntime.authProvider) {
    case 'preview_local':
      return createPreviewLocalAuthProvider(appRuntime.authProvider);
    case 'custom':
      return isCustomAuthRuntimeConfigured()
        ? createCustomApiAuthProvider()
        : createRuntimeBridgeAuthProvider(appRuntime.authProvider);
    case 'firebase_auth':
    case 'supabase_auth':
      return createRuntimeBridgeAuthProvider(appRuntime.authProvider);
    default:
      return createPreviewLocalAuthProvider('preview_local');
  }
}

export function isCredentialAuthRuntimeReady() {
  return (
    appRuntime.authProvider === 'preview_local' ||
    (appRuntime.authProvider === 'custom' && isCustomAuthRuntimeConfigured())
  );
}

export function isMockAuthSession(session: AuthSession | null | undefined) {
  if (!session) {
    return false;
  }

  return (
    session.accessToken.startsWith('mock_') ||
    session.metadata?.authMode === 'preview_local' ||
    session.metadata?.authMode === 'provider_bridge'
  );
}

export function getAuthSessionRuntimeLabel(
  session: AuthSession | null | undefined,
) {
  if (!session) {
    return appRuntime.requireAuthentication
      ? getAuthRuntimeDisplayLabel()
      : 'Misafir erişim';
  }

  if (session.metadata?.authMode === 'provider_bridge') {
    return `${getAuthRuntimeDisplayLabel()} köprüsü`;
  }

  return isMockAuthSession(session)
    ? 'Önizleme oturumu'
    : getAuthRuntimeDisplayLabel();
}

export function getAuthActiveWorkspace(
  session: AuthSession | null | undefined,
) {
  if (!session) {
    return null;
  }

  return (
    session.workspaces.find(
      (workspace) => workspace.id === session.activeWorkspaceId,
    ) ??
    session.workspaces[0] ??
    null
  );
}

export function getAuthWorkspaceSummaryLabel(
  session: AuthSession | null | undefined,
) {
  const activeWorkspace = getAuthActiveWorkspace(session);
  return activeWorkspace?.name ?? 'Çalışma alanı yok';
}

export function getAuthWorkspaceRoleLabel(
  role: AuthWorkspaceRole | null | undefined,
) {
  if (!role) {
    return 'Yok';
  }

  switch (role) {
    case 'owner':
      return 'Sahip';
    case 'admin':
      return 'Yönetici';
    case 'member':
      return 'Üye';
    case 'viewer':
    default:
      return 'Görüntüleyici';
  }
}

async function readStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeStoredSession(parsed);

    if (!normalized) {
      await clearStoredSession();
      return null;
    }

    return normalized;
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

export async function hydrateAuthSession(): Promise<AuthSession | null> {
  const provider = getAuthProvider();
  const storedSession = await readStoredSession();
  const hydrated = await provider.hydrate({ storedSession });

  if (!hydrated) {
    await clearStoredSession();
    return null;
  }

  await setStoredSession(hydrated);
  return hydrated;
}

export async function loginWithPassword(
  input: AuthLoginInput,
): Promise<AuthSession> {
  const provider = getAuthProvider();
  const session = await provider.login(input);
  await setStoredSession(session);
  return session;
}

export async function registerWithPassword(
  input: AuthRegisterInput,
): Promise<AuthSession> {
  const provider = getAuthProvider();
  const session = await provider.register(input);
  await setStoredSession(session);
  return session;
}

export async function logoutCurrentSession(
  session: AuthSession | null,
): Promise<void> {
  const provider = getAuthProvider();
  await provider.logout({ session });
  await clearStoredSession();
}

export async function refreshStoredSessionWorkspaceContext(
  session: AuthSession | null | undefined,
): Promise<AuthSession | null> {
  if (!session) {
    return null;
  }

  const provider = getAuthProvider();
  const nextSession = await provider.refreshWorkspaceContext({ session });
  await setStoredSession(nextSession);
  return nextSession;
}

export async function switchStoredSessionWorkspace(input: {
  session: AuthSession;
  workspaceId: string;
}): Promise<AuthSession> {
  const provider = getAuthProvider();
  const nextSession = await provider.switchWorkspace(input);
  await setStoredSession(nextSession);
  return nextSession;
}
