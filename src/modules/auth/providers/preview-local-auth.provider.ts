import type { AuthRuntimeProvider } from '../../../config/runtime';
import {
  getWorkspaceDisplayName,
  getWorkspaceProfile,
} from '../../workspace/workspace.service';
import type { AuthProviderAdapter } from '../auth-provider';
import type {
  AuthLoginInput,
  AuthRegisterInput,
  AuthSession,
  AuthSessionMetadata,
  AuthUser,
  AuthWorkspace,
} from '../auth.types';

function slugify(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (character) => {
      switch (character) {
        case 'ç':
        case 'Ç':
          return 'c';
        case 'ğ':
        case 'Ğ':
          return 'g';
        case 'ı':
        case 'İ':
          return 'i';
        case 'ö':
        case 'Ö':
          return 'o';
        case 'ş':
        case 'Ş':
          return 's';
        case 'ü':
        case 'Ü':
          return 'u';
        default:
          return character;
      }
    })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'workspace';
}

function generateLocalToken(email: string) {
  const randomPart = Math.random().toString(36).slice(2);
  return `mock_${email.replace(/[^a-z0-9]/gi, '')}_${Date.now()}_${randomPart}`;
}

function normalizeName(inputName: string | undefined, email: string) {
  const fallback =
    email.split('@')[0]?.replace(/[^a-z0-9]/gi, ' ')?.trim() || 'Kullanici';

  const normalized = inputName?.trim();
  return normalized && normalized.length >= 2 ? normalized : fallback;
}

function buildPersonalWorkspace(
  user: AuthUser,
  hasCorporateWorkspace: boolean,
): AuthWorkspace {
  return {
    id: `personal:${user.id}`,
    slug: `personal-${slugify(user.email)}`,
    name: `${user.name} / Kişisel`,
    role: 'owner',
    source: 'personal',
    isPersonal: true,
    isDefault: !hasCorporateWorkspace,
  };
}

async function buildWorkspaceList(user: AuthUser): Promise<AuthWorkspace[]> {
  const workspaceProfile = await getWorkspaceProfile();
  const workspaceDisplayName = getWorkspaceDisplayName(workspaceProfile);
  const corporateWorkspace = workspaceDisplayName
    ? {
        id: 'workspace:local-profile',
        slug: `workspace-${slugify(workspaceDisplayName)}`,
        name: workspaceDisplayName,
        role: 'admin' as const,
        source: 'local_profile' as const,
        isPersonal: false,
        isDefault: true,
      }
    : null;

  const personalWorkspace = buildPersonalWorkspace(user, Boolean(corporateWorkspace));

  return corporateWorkspace
    ? [corporateWorkspace, personalWorkspace]
    : [personalWorkspace];
}

function resolveActiveWorkspaceId(
  workspaces: AuthWorkspace[],
  preferredWorkspaceId: string | null | undefined,
) {
  if (!workspaces.length) {
    return null;
  }

  if (
    preferredWorkspaceId &&
    workspaces.some((workspace) => workspace.id === preferredWorkspaceId)
  ) {
    return preferredWorkspaceId;
  }

  return (
    workspaces.find((workspace) => workspace.isDefault)?.id ??
    workspaces[0]?.id ??
    null
  );
}

function buildMetadata(input: {
  runtimeProvider: AuthRuntimeProvider;
  previousMetadata?: AuthSession['metadata'];
}): AuthSessionMetadata {
  const now = new Date().toISOString();

  return {
    authMode:
      input.runtimeProvider === 'preview_local'
        ? 'preview_local'
        : 'provider_bridge',
    provider: input.runtimeProvider,
    createdAt: input.previousMetadata?.createdAt ?? now,
    updatedAt: now,
    workspaceContext: 'local_preview',
    version: 'v3',
  };
}

async function finalizeSession(
  runtimeProvider: AuthRuntimeProvider,
  session: Pick<AuthSession, 'accessToken' | 'refreshToken' | 'user'> & {
    activeWorkspaceId?: string | null;
    metadata?: AuthSession['metadata'];
  },
) {
  const workspaces = await buildWorkspaceList(session.user);
  const activeWorkspaceId = resolveActiveWorkspaceId(
    workspaces,
    session.activeWorkspaceId,
  );

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken ?? null,
    user: session.user,
    workspaces,
    activeWorkspaceId,
    metadata: buildMetadata({
      runtimeProvider,
      previousMetadata: session.metadata,
    }),
  } satisfies AuthSession;
}

function createSessionUser(input: AuthRegisterInput): AuthUser {
  const email = input.email.trim().toLowerCase();

  return {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: normalizeName(input.name, email),
    email,
  };
}

export function createPreviewLocalAuthProvider(
  runtimeProvider: AuthRuntimeProvider,
): AuthProviderAdapter {
  return {
    hydrate: async ({ storedSession }) => {
      if (!storedSession) {
        return null;
      }

      return finalizeSession(runtimeProvider, storedSession);
    },

    login: async (input: AuthLoginInput) => {
      const email = input.email.trim().toLowerCase();

      if (!email) {
        throw new Error('E-posta zorunludur.');
      }

      if (!input.password.trim()) {
        throw new Error('Şifre zorunludur.');
      }

      return finalizeSession(runtimeProvider, {
        accessToken: generateLocalToken(email),
        refreshToken: null,
        user: createSessionUser({
          email,
          password: input.password,
        }),
      });
    },

    register: async (input: AuthRegisterInput) => {
      const email = input.email.trim().toLowerCase();

      if (!email) {
        throw new Error('E-posta zorunludur.');
      }

      if (!input.password.trim()) {
        throw new Error('Şifre zorunludur.');
      }

      return finalizeSession(runtimeProvider, {
        accessToken: generateLocalToken(email),
        refreshToken: null,
        user: createSessionUser(input),
      });
    },

    logout: async () => undefined,

    refreshWorkspaceContext: async ({ session }) => {
      return finalizeSession(runtimeProvider, session);
    },

    switchWorkspace: async ({ session, workspaceId }) => {
      const nextSession = await finalizeSession(runtimeProvider, {
        ...session,
        activeWorkspaceId: workspaceId,
      });

      if (!nextSession.workspaces.some((workspace) => workspace.id === workspaceId)) {
        throw new Error('Seçilen çalışma alanı bulunamadı.');
      }

      return nextSession;
    },
  };
}
