import type { AuthRuntimeProvider } from '../../config/runtime';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthWorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type AuthWorkspaceSource = 'personal' | 'local_profile' | 'remote';

export type AuthWorkspace = {
  id: string;
  slug: string;
  name: string;
  role: AuthWorkspaceRole;
  source: AuthWorkspaceSource;
  isPersonal: boolean;
  isDefault: boolean;
};

export type AuthSessionMode =
  | 'preview_local'
  | 'provider_bridge'
  | 'provider_managed';

export type AuthSessionMetadata = {
  authMode: AuthSessionMode;
  provider: AuthRuntimeProvider;
  createdAt: string;
  updatedAt: string;
  workspaceContext: 'local_preview' | 'remote';
  version: 'v3';
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string | null;
  user: AuthUser;
  workspaces: AuthWorkspace[];
  activeWorkspaceId: string | null;
  metadata?: AuthSessionMetadata | null;
};

export type AuthLoginInput = {
  email: string;
  password: string;
};

export type AuthRegisterInput = {
  name?: string;
  email: string;
  password: string;
};
