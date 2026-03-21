import { appRuntime } from '../../../config/runtime';
import {
  authRemoteRuntimeConfig,
  isCustomAuthRuntimeConfigured,
} from '../auth-remote-config.service';
import type { AuthProviderAdapter } from '../auth-provider';
import type {
  AuthSession,
  AuthWorkspace,
  AuthWorkspaceRole,
} from '../auth.types';

type RemoteWorkspacePayload = {
  id?: string | number | null;
  slug?: string | null;
  name?: string | null;
  role?: string | null;
  isPersonal?: boolean | null;
  isDefault?: boolean | null;
};

type RemoteUserPayload = {
  id?: string | number | null;
  name?: string | null;
  fullName?: string | null;
  displayName?: string | null;
  email?: string | null;
};

type RemoteSessionPayload = {
  accessToken?: string | null;
  refreshToken?: string | null;
  activeWorkspaceId?: string | number | null;
  user?: RemoteUserPayload | null;
  workspaces?: RemoteWorkspacePayload[] | null;
};

type RemoteEnvelope = {
  session?: RemoteSessionPayload | null;
  data?: RemoteSessionPayload | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  activeWorkspaceId?: string | number | null;
  user?: RemoteUserPayload | null;
  workspaces?: RemoteWorkspacePayload[] | null;
};

function assertCustomRuntimeConfigured() {
  if (isCustomAuthRuntimeConfigured()) {
    return;
  }

  throw new Error(
    'Custom auth runtime için EXPO_PUBLIC_AUTH_API_BASE_URL yapılandırılmalı.',
  );
}

function buildUrl(path: string) {
  const baseUrl = authRemoteRuntimeConfig.baseUrl;

  if (!baseUrl) {
    throw new Error('Custom auth runtime temel adresi eksik.');
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}${path}`;
}

async function fetchJson<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Uzak auth isteği zaman aşımına uğradı.'));
    }, authRemoteRuntimeConfig.requestTimeoutMs);
  });

  const response = (await Promise.race([
    fetch(buildUrl(path), init),
    timeoutPromise,
  ])) as Response;

  const raw = await response.text();
  const payload = raw.trim().length > 0 ? (JSON.parse(raw) as unknown) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message?: unknown }).message ?? '').trim()
        : '';

    throw new Error(
      message || 'Uzak auth sağlayıcısı isteği başarısız oldu.',
    );
  }

  return payload as T;
}

function normalizeWorkspaceRole(value: string | null | undefined): AuthWorkspaceRole {
  switch (value) {
    case 'owner':
    case 'admin':
    case 'member':
    case 'viewer':
      return value;
    default:
      return 'member';
  }
}

function buildFallbackWorkspace(user: AuthSession['user']): AuthWorkspace {
  return {
    id: `personal:${user.id}`,
    slug: `personal-${user.id}`,
    name: `${user.name} / Kişisel`,
    role: 'owner',
    source: 'remote',
    isPersonal: true,
    isDefault: true,
  };
}

function normalizeRemoteUser(value: RemoteUserPayload | null | undefined) {
  const email =
    typeof value?.email === 'string' && value.email.trim().length > 0
      ? value.email.trim().toLowerCase()
      : '';
  const nameCandidate =
    value?.name ?? value?.fullName ?? value?.displayName ?? email.split('@')[0] ?? '';
  const name =
    typeof nameCandidate === 'string' && nameCandidate.trim().length > 0
      ? nameCandidate.trim()
      : 'Kullanıcı';
  const idCandidate = value?.id;
  const id =
    typeof idCandidate === 'string' || typeof idCandidate === 'number'
      ? String(idCandidate)
      : `remote_${email || Date.now()}`;

  if (!email) {
    throw new Error('Uzak auth yanıtında kullanıcı e-postası eksik.');
  }

  return {
    id,
    name,
    email,
  };
}

function normalizeRemoteWorkspaces(
  workspaces: RemoteWorkspacePayload[] | null | undefined,
  user: AuthSession['user'],
) {
  const normalized = (workspaces ?? [])
    .map((workspace, index) => {
      const idCandidate = workspace.id;
      const id =
        typeof idCandidate === 'string' || typeof idCandidate === 'number'
          ? String(idCandidate)
          : null;
      const name =
        typeof workspace.name === 'string' && workspace.name.trim().length > 0
          ? workspace.name.trim()
          : null;

      if (!id || !name) {
        return null;
      }

      return {
        id,
        slug:
          typeof workspace.slug === 'string' && workspace.slug.trim().length > 0
            ? workspace.slug.trim()
            : `workspace-${index + 1}`,
        name,
        role: normalizeWorkspaceRole(workspace.role),
        source: 'remote' as const,
        isPersonal: workspace.isPersonal === true,
        isDefault: workspace.isDefault === true,
      } satisfies AuthWorkspace;
    })
    .filter(Boolean) as AuthWorkspace[];

  if (normalized.length > 0) {
    return normalized;
  }

  return [buildFallbackWorkspace(user)];
}

function normalizeRemoteSession(
  payload: RemoteEnvelope,
  previousSession?: AuthSession | null,
): AuthSession {
  const candidate = payload.session ?? payload.data ?? payload;
  const accessToken =
    typeof candidate.accessToken === 'string' && candidate.accessToken.trim().length > 0
      ? candidate.accessToken.trim()
      : previousSession?.accessToken ?? null;

  if (!accessToken) {
    throw new Error('Uzak auth yanıtında access token eksik.');
  }

  const user = normalizeRemoteUser(candidate.user ?? previousSession?.user);
  const workspaces = normalizeRemoteWorkspaces(candidate.workspaces, user);
  const activeWorkspaceIdCandidate = candidate.activeWorkspaceId;
  const activeWorkspaceId =
    typeof activeWorkspaceIdCandidate === 'string' ||
    typeof activeWorkspaceIdCandidate === 'number'
      ? String(activeWorkspaceIdCandidate)
      : previousSession?.activeWorkspaceId ??
        workspaces.find((workspace) => workspace.isDefault)?.id ??
        workspaces[0]?.id ??
        null;
  const now = new Date().toISOString();

  return {
    accessToken,
    refreshToken:
      typeof candidate.refreshToken === 'string' && candidate.refreshToken.trim().length > 0
        ? candidate.refreshToken.trim()
        : previousSession?.refreshToken ?? null,
    user,
    workspaces,
    activeWorkspaceId,
    metadata: {
      authMode: 'provider_managed',
      provider: appRuntime.authProvider,
      createdAt: previousSession?.metadata?.createdAt ?? now,
      updatedAt: now,
      workspaceContext: 'remote',
      version: 'v3',
    },
  };
}

function buildAuthHeaders(accessToken?: string | null) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : null),
  };
}

export function createCustomApiAuthProvider(): AuthProviderAdapter {
  return {
    hydrate: async ({ storedSession }) => {
      assertCustomRuntimeConfigured();

      if (!storedSession?.accessToken) {
        return null;
      }

      try {
        const response = await fetchJson<RemoteEnvelope>(
          authRemoteRuntimeConfig.sessionPath,
          {
            method: 'GET',
            headers: buildAuthHeaders(storedSession.accessToken),
          },
        );

        return normalizeRemoteSession(response, storedSession);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';

        if (/401|403/.test(message)) {
          return null;
        }

        throw error;
      }
    },

    login: async (input) => {
      assertCustomRuntimeConfigured();

      const response = await fetchJson<RemoteEnvelope>(
        authRemoteRuntimeConfig.loginPath,
        {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: JSON.stringify({
            email: input.email.trim().toLowerCase(),
            password: input.password,
          }),
        },
      );

      return normalizeRemoteSession(response, null);
    },

    register: async (input) => {
      assertCustomRuntimeConfigured();

      const response = await fetchJson<RemoteEnvelope>(
        authRemoteRuntimeConfig.registerPath,
        {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: JSON.stringify({
            name: input.name?.trim() ?? '',
            email: input.email.trim().toLowerCase(),
            password: input.password,
          }),
        },
      );

      return normalizeRemoteSession(response, null);
    },

    logout: async ({ session }) => {
      assertCustomRuntimeConfigured();

      if (!session?.accessToken) {
        return;
      }

      try {
        await fetchJson<unknown>(authRemoteRuntimeConfig.logoutPath, {
          method: 'POST',
          headers: buildAuthHeaders(session.accessToken),
          body: JSON.stringify({}),
        });
      } catch (error) {
        console.warn('[AuthService] Remote logout failed:', error);
      }
    },

    refreshWorkspaceContext: async ({ session }) => {
      assertCustomRuntimeConfigured();

      const response = await fetchJson<RemoteEnvelope>(
        authRemoteRuntimeConfig.sessionPath,
        {
          method: 'GET',
          headers: buildAuthHeaders(session.accessToken),
        },
      );

      return normalizeRemoteSession(response, session);
    },

    switchWorkspace: async ({ session, workspaceId }) => {
      assertCustomRuntimeConfigured();

      const response = await fetchJson<RemoteEnvelope>(
        authRemoteRuntimeConfig.switchWorkspacePath,
        {
          method: 'POST',
          headers: buildAuthHeaders(session.accessToken),
          body: JSON.stringify({ workspaceId }),
        },
      );

      return normalizeRemoteSession(response, session);
    },
  };
}
