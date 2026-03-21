import type {
  AuthLoginInput,
  AuthRegisterInput,
  AuthSession,
} from './auth.types';

export type HydrateAuthProviderInput = {
  storedSession: AuthSession | null;
};

export interface AuthProviderAdapter {
  hydrate(input: HydrateAuthProviderInput): Promise<AuthSession | null>;
  login(input: AuthLoginInput): Promise<AuthSession>;
  register(input: AuthRegisterInput): Promise<AuthSession>;
  logout(input: { session: AuthSession | null }): Promise<void>;
  refreshWorkspaceContext(input: { session: AuthSession }): Promise<AuthSession>;
  switchWorkspace(input: {
    session: AuthSession;
    workspaceId: string;
  }): Promise<AuthSession>;
}
