import {
  getAuthRuntimeDisplayLabel,
  type AuthRuntimeProvider,
} from '../../../config/runtime';
import type { AuthProviderAdapter } from '../auth-provider';
import { createPreviewLocalAuthProvider } from './preview-local-auth.provider';

function buildUnavailableProviderMessage(runtimeProvider: AuthRuntimeProvider) {
  const providerLabel = getAuthRuntimeDisplayLabel();

  switch (runtimeProvider) {
    case 'firebase_auth':
    case 'supabase_auth':
    case 'custom':
      return `${providerLabel} entegrasyonu bu build'de henüz bağlanmadı.`;
    case 'preview_local':
    default:
      return 'Auth sağlayıcısı henüz bağlanmadı.';
  }
}

export function createRuntimeBridgeAuthProvider(
  runtimeProvider: Exclude<AuthRuntimeProvider, 'preview_local'>,
): AuthProviderAdapter {
  const workspaceAwareProvider = createPreviewLocalAuthProvider(runtimeProvider);
  const unavailableMessage = buildUnavailableProviderMessage(runtimeProvider);

  return {
    hydrate: workspaceAwareProvider.hydrate,
    refreshWorkspaceContext: workspaceAwareProvider.refreshWorkspaceContext,
    switchWorkspace: workspaceAwareProvider.switchWorkspace,
    logout: async () => undefined,
    login: async () => {
      throw new Error(unavailableMessage);
    },
    register: async () => {
      throw new Error(unavailableMessage);
    },
  };
}
