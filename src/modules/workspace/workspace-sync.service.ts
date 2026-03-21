import * as SecureStore from 'expo-secure-store';

import { appRuntime } from '../../config/runtime';
import { getDb } from '../../db/sqlite';
import { getAuthActiveWorkspace } from '../auth/auth.service';
import {
  authRemoteRuntimeConfig,
  isCustomAuthRuntimeConfigured,
} from '../auth/auth-remote-config.service';
import type {
  AuthSession,
  AuthWorkspaceRole,
} from '../auth/auth.types';
import {
  isCustomWorkspaceSyncConfigured,
  workspaceSyncRemoteRuntimeConfig,
} from './workspace-sync-remote-config.service';
import {
  runWorkspaceSyncRemotePreflight,
  type WorkspaceSyncRemoteMembershipStatus,
  type WorkspaceSyncRemotePushResult,
} from './workspace-sync-remote.service';

const WORKSPACE_SYNC_STATE_KEY = 'pdf-kase.workspace-sync.state.v1';

export type WorkspaceSyncStatus = 'idle' | 'ready' | 'blocked' | 'error';

export type WorkspaceSyncMode =
  | 'local_only'
  | 'bridge'
  | 'remote_ready'
  | 'workspace_missing';

type PersistedWorkspaceSyncEntry = {
  lastCheckedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastStatus: WorkspaceSyncStatus;
  lastError: string | null;
  membershipStatus: WorkspaceSyncRemoteMembershipStatus;
  remoteSummary: string | null;
};

type PersistedWorkspaceSyncState = {
  version: 'v1';
  workspaces: Record<string, PersistedWorkspaceSyncEntry>;
};

export type WorkspaceSyncSnapshot = {
  workspaceId: string | null;
  workspaceName: string;
  workspaceRole: AuthWorkspaceRole | null;
  mode: WorkspaceSyncMode;
  lastStatus: WorkspaceSyncStatus;
  lastError: string | null;
  membershipStatus: WorkspaceSyncRemoteMembershipStatus;
  remoteSummary: string | null;
  blockingReason: string | null;
  remoteBaseUrl: string | null;
  canUseRemoteSync: boolean;
  documentCount: number;
  pageCount: number;
  workspaceStampCount: number;
  personalStampCount: number;
  signatureCount: number;
  syncCandidateCount: number;
  lastLocalChangeAt: string | null;
  hasPendingLocalChanges: boolean;
  lastCheckedAt: string | null;
  lastSuccessfulSyncAt: string | null;
};

type WorkspaceLocalInventory = {
  documentCount: number;
  pageCount: number;
  workspaceStampCount: number;
  personalStampCount: number;
  signatureCount: number;
  lastLocalChangeAt: string | null;
};

function createDefaultPersistedState(): PersistedWorkspaceSyncState {
  return {
    version: 'v1',
    workspaces: {},
  };
}

function isValidStatus(value: unknown): value is WorkspaceSyncStatus {
  return (
    value === 'idle' ||
    value === 'ready' ||
    value === 'blocked' ||
    value === 'error'
  );
}

function normalizePersistedState(
  value: unknown,
): PersistedWorkspaceSyncState {
  if (!value || typeof value !== 'object') {
    return createDefaultPersistedState();
  }

  const parsed = value as Partial<PersistedWorkspaceSyncState>;
  const nextState = createDefaultPersistedState();
  const workspaces =
    parsed.workspaces && typeof parsed.workspaces === 'object'
      ? parsed.workspaces
      : null;

  if (!workspaces) {
    return nextState;
  }

  for (const [workspaceId, entry] of Object.entries(workspaces)) {
    if (!workspaceId.trim() || !entry || typeof entry !== 'object') {
      continue;
    }

    const normalizedEntry = entry as Partial<PersistedWorkspaceSyncEntry>;

    nextState.workspaces[workspaceId] = {
      lastCheckedAt:
        typeof normalizedEntry.lastCheckedAt === 'string' &&
        normalizedEntry.lastCheckedAt.trim().length > 0
          ? normalizedEntry.lastCheckedAt
          : null,
      lastSuccessfulSyncAt:
        typeof normalizedEntry.lastSuccessfulSyncAt === 'string' &&
        normalizedEntry.lastSuccessfulSyncAt.trim().length > 0
          ? normalizedEntry.lastSuccessfulSyncAt
          : null,
      lastStatus: isValidStatus(normalizedEntry.lastStatus)
        ? normalizedEntry.lastStatus
        : 'idle',
      lastError:
        typeof normalizedEntry.lastError === 'string' &&
        normalizedEntry.lastError.trim().length > 0
          ? normalizedEntry.lastError
          : null,
      membershipStatus:
        normalizedEntry.membershipStatus === 'verified' ||
        normalizedEntry.membershipStatus === 'missing' ||
        normalizedEntry.membershipStatus === 'denied' ||
        normalizedEntry.membershipStatus === 'unverified'
          ? normalizedEntry.membershipStatus
          : 'unverified',
      remoteSummary:
        typeof normalizedEntry.remoteSummary === 'string' &&
        normalizedEntry.remoteSummary.trim().length > 0
          ? normalizedEntry.remoteSummary
          : null,
    };
  }

  return nextState;
}

async function readPersistedWorkspaceSyncState() {
  try {
    const raw = await SecureStore.getItemAsync(WORKSPACE_SYNC_STATE_KEY);

    if (!raw) {
      return createDefaultPersistedState();
    }

    return normalizePersistedState(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn('[WorkspaceSyncService] Failed to read persisted state:', error);
    return createDefaultPersistedState();
  }
}

async function writePersistedWorkspaceSyncState(
  state: PersistedWorkspaceSyncState,
) {
  await SecureStore.setItemAsync(
    WORKSPACE_SYNC_STATE_KEY,
    JSON.stringify(state),
  );
}

function getWorkspaceSyncMode(
  session: AuthSession | null,
  hasWorkspace: boolean,
): WorkspaceSyncMode {
  if (!hasWorkspace) {
    return 'workspace_missing';
  }

  if (!session) {
    return 'local_only';
  }

  if (
    session.metadata?.authMode === 'provider_managed' &&
    appRuntime.authProvider === 'custom' &&
    isCustomAuthRuntimeConfigured()
  ) {
    return 'remote_ready';
  }

  if (session.metadata?.authMode === 'provider_bridge') {
    return 'bridge';
  }

  return 'local_only';
}

function getBlockingReason(
  mode: WorkspaceSyncMode,
  session: AuthSession | null,
) {
  switch (mode) {
    case 'workspace_missing':
      return 'Aktif çalışma alanı bulunamadı. Önce hesap ya da şirket bağlamını netleştir.';
    case 'bridge':
      return 'Auth runtime köprü modunda. Gerçek ekip üyeliği ve sync endpointleri bağlanmadan bulut eşitleme başlayamaz.';
    case 'local_only':
      return session
        ? 'Bu build yerel preview modunda çalışıyor. Veriler cihazda güvenle tutuluyor ama buluta çıkmıyor.'
        : 'Bulut eşitleme için önce oturum ve çalışma alanı bağlamı gerekli.';
    case 'remote_ready':
    default:
      return null;
  }
}

async function getWorkspaceLocalInventory(): Promise<WorkspaceLocalInventory> {
  const db = await getDb();
  const [
    documentRow,
    pageRow,
    workspaceStampRow,
    personalStampRow,
    signatureRow,
    latestChangeRow,
  ] = await Promise.all([
    db.getFirstAsync<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM documents
      `,
    ),
    db.getFirstAsync<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM document_pages
      `,
    ),
    db.getFirstAsync<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM assets
        WHERE type = 'stamp' AND library_scope = 'workspace'
      `,
    ),
    db.getFirstAsync<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM assets
        WHERE type = 'stamp' AND library_scope = 'personal'
      `,
    ),
    db.getFirstAsync<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM assets
        WHERE type = 'signature'
      `,
    ),
    db.getFirstAsync<{ value: string | null }>(
      `
        SELECT MAX(changed_at) AS value
        FROM (
          SELECT updated_at AS changed_at FROM documents
          UNION ALL
          SELECT created_at AS changed_at FROM document_pages
          UNION ALL
          SELECT created_at AS changed_at FROM assets
          UNION ALL
          SELECT updated_at AS changed_at FROM workspace_profiles
        )
      `,
    ),
  ]);

  return {
    documentCount: documentRow?.count ?? 0,
    pageCount: pageRow?.count ?? 0,
    workspaceStampCount: workspaceStampRow?.count ?? 0,
    personalStampCount: personalStampRow?.count ?? 0,
    signatureCount: signatureRow?.count ?? 0,
    lastLocalChangeAt: latestChangeRow?.value ?? null,
  };
}

function hasPendingChanges(
  lastLocalChangeAt: string | null,
  lastSuccessfulSyncAt: string | null,
) {
  if (!lastLocalChangeAt) {
    return false;
  }

  if (!lastSuccessfulSyncAt) {
    return true;
  }

  return lastLocalChangeAt > lastSuccessfulSyncAt;
}

async function buildWorkspaceSyncSnapshot(
  session: AuthSession | null,
  persistedEntry?: PersistedWorkspaceSyncEntry | null,
): Promise<WorkspaceSyncSnapshot> {
  const activeWorkspace = getAuthActiveWorkspace(session);
  const inventory = await getWorkspaceLocalInventory();
  const mode = getWorkspaceSyncMode(session, Boolean(activeWorkspace));
  const lastSuccessfulSyncAt = persistedEntry?.lastSuccessfulSyncAt ?? null;

  return {
    workspaceId: activeWorkspace?.id ?? null,
    workspaceName: activeWorkspace?.name ?? 'Çalışma alanı yok',
    workspaceRole: activeWorkspace?.role ?? null,
    mode,
    lastStatus: persistedEntry?.lastStatus ?? 'idle',
    lastError: persistedEntry?.lastError ?? null,
    membershipStatus: persistedEntry?.membershipStatus ?? 'unverified',
    remoteSummary: persistedEntry?.remoteSummary ?? null,
    blockingReason: getBlockingReason(mode, session),
    remoteBaseUrl:
      appRuntime.authProvider === 'custom' &&
      (isCustomWorkspaceSyncConfigured() || isCustomAuthRuntimeConfigured())
        ? workspaceSyncRemoteRuntimeConfig.baseUrl ?? authRemoteRuntimeConfig.baseUrl
        : null,
    canUseRemoteSync: mode === 'remote_ready',
    documentCount: inventory.documentCount,
    pageCount: inventory.pageCount,
    workspaceStampCount: inventory.workspaceStampCount,
    personalStampCount: inventory.personalStampCount,
    signatureCount: inventory.signatureCount,
    syncCandidateCount:
      inventory.documentCount +
      inventory.workspaceStampCount +
      inventory.signatureCount,
    lastLocalChangeAt: inventory.lastLocalChangeAt,
    hasPendingLocalChanges: hasPendingChanges(
      inventory.lastLocalChangeAt,
      lastSuccessfulSyncAt,
    ),
    lastCheckedAt: persistedEntry?.lastCheckedAt ?? null,
    lastSuccessfulSyncAt,
  };
}

async function updateWorkspaceSyncEntry(
  workspaceId: string,
  updater: (current: PersistedWorkspaceSyncEntry) => PersistedWorkspaceSyncEntry,
) {
  const state = await readPersistedWorkspaceSyncState();
  const currentEntry =
    state.workspaces[workspaceId] ?? {
      lastCheckedAt: null,
      lastSuccessfulSyncAt: null,
      lastStatus: 'idle' as const,
      lastError: null,
      membershipStatus: 'unverified' as const,
      remoteSummary: null,
    };

  state.workspaces[workspaceId] = updater(currentEntry);
  await writePersistedWorkspaceSyncState(state);

  return state.workspaces[workspaceId];
}

export function getWorkspaceSyncModeLabel(mode: WorkspaceSyncMode) {
  switch (mode) {
    case 'remote_ready':
      return 'Uzak sync hazır';
    case 'bridge':
      return 'Köprü modunda';
    case 'workspace_missing':
      return 'Çalışma alanı eksik';
    case 'local_only':
    default:
      return 'Sadece yerel';
  }
}

export function getWorkspaceSyncStatusLabel(status: WorkspaceSyncStatus) {
  switch (status) {
    case 'ready':
      return 'Hazırlık tamam';
    case 'blocked':
      return 'Bağlantı bekliyor';
    case 'error':
      return 'Kontrol hatası';
    case 'idle':
    default:
      return 'Henüz kontrol edilmedi';
  }
}

export function getWorkspaceSyncPendingLabel(
  snapshot: Pick<WorkspaceSyncSnapshot, 'hasPendingLocalChanges' | 'syncCandidateCount'>,
) {
  if (!snapshot.hasPendingLocalChanges) {
    return 'Yerel değişiklik yok';
  }

  return `${snapshot.syncCandidateCount} kayıt hazır`;
}

export function getWorkspaceSyncMembershipLabel(
  status: WorkspaceSyncRemoteMembershipStatus,
) {
  switch (status) {
    case 'verified':
      return 'Üyelik doğrulandı';
    case 'missing':
      return 'Üyelik bulunamadı';
    case 'denied':
      return 'Yetki reddedildi';
    case 'unverified':
    default:
      return 'Üyelik doğrulanmadı';
  }
}

export async function getWorkspaceSyncSnapshot(
  session: AuthSession | null,
): Promise<WorkspaceSyncSnapshot> {
  const activeWorkspace = getAuthActiveWorkspace(session);
  const persistedState = await readPersistedWorkspaceSyncState();
  const persistedEntry = activeWorkspace
    ? persistedState.workspaces[activeWorkspace.id] ?? null
    : null;

  return buildWorkspaceSyncSnapshot(session, persistedEntry);
}

export async function checkWorkspaceSyncReadiness(
  session: AuthSession | null,
) {
  const activeWorkspace = getAuthActiveWorkspace(session);
  const checkedAt = new Date().toISOString();

  if (!activeWorkspace) {
    return buildWorkspaceSyncSnapshot(session, {
      lastCheckedAt: checkedAt,
      lastSuccessfulSyncAt: null,
      lastStatus: 'blocked',
      lastError: 'Aktif çalışma alanı bulunamadı.',
      membershipStatus: 'missing',
      remoteSummary: null,
    });
  }

  const mode = getWorkspaceSyncMode(session, true);
  if (mode === 'remote_ready' && session?.accessToken) {
    try {
      const localSnapshot = await getWorkspaceSyncSnapshot(session);
      const remoteResult = await runWorkspaceSyncRemotePreflight({
        accessToken: session.accessToken,
        workspace: {
          id: activeWorkspace.id,
          slug: activeWorkspace.slug,
          name: activeWorkspace.name,
          role: activeWorkspace.role,
          isPersonal: activeWorkspace.isPersonal,
        },
        inventory: {
          documentCount: localSnapshot.documentCount,
          pageCount: localSnapshot.pageCount,
          workspaceStampCount: localSnapshot.workspaceStampCount,
          personalStampCount: localSnapshot.personalStampCount,
          signatureCount: localSnapshot.signatureCount,
          syncCandidateCount: localSnapshot.syncCandidateCount,
        },
        lastLocalChangeAt: localSnapshot.lastLocalChangeAt,
        lastSuccessfulSyncAt: localSnapshot.lastSuccessfulSyncAt,
      });

      const entry = await updateWorkspaceSyncEntry(activeWorkspace.id, (current) => ({
        ...current,
        lastCheckedAt: checkedAt,
        lastSuccessfulSyncAt:
          remoteResult.lastSuccessfulSyncAt ?? current.lastSuccessfulSyncAt,
        lastStatus: remoteResult.status,
        lastError:
          remoteResult.status === 'error' || remoteResult.status === 'blocked'
            ? remoteResult.summary ?? getBlockingReason(mode, session)
            : null,
        membershipStatus: remoteResult.membershipStatus,
        remoteSummary: remoteResult.summary,
      }));

      return buildWorkspaceSyncSnapshot(session, entry);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Uzak sync hazırlığı doğrulanamadı.';
      const entry = await updateWorkspaceSyncEntry(activeWorkspace.id, (current) => ({
        ...current,
        lastCheckedAt: checkedAt,
        lastStatus: 'error',
        lastError: message,
        membershipStatus: 'unverified',
        remoteSummary: message,
      }));

      return buildWorkspaceSyncSnapshot(session, entry);
    }
  }

  const nextStatus = 'blocked';
  const nextError = getBlockingReason(mode, session);
  const entry = await updateWorkspaceSyncEntry(activeWorkspace.id, (current) => ({
    ...current,
    lastCheckedAt: checkedAt,
    lastStatus: nextStatus,
    lastError: nextError,
    membershipStatus:
      mode === 'workspace_missing' ? 'missing' : current.membershipStatus,
    remoteSummary: nextError,
  }));

  return buildWorkspaceSyncSnapshot(session, entry);
}

export async function markWorkspaceSyncSuccess(
  session: AuthSession | null,
) {
  const activeWorkspace = getAuthActiveWorkspace(session);

  if (!activeWorkspace) {
    throw new Error('Başarılı sync işaretlemek için aktif çalışma alanı gerekli.');
  }

  const now = new Date().toISOString();
  const entry = await updateWorkspaceSyncEntry(activeWorkspace.id, (current) => ({
    ...current,
    lastCheckedAt: now,
    lastSuccessfulSyncAt: now,
    lastStatus: 'ready',
    lastError: null,
    membershipStatus:
      current.membershipStatus === 'unverified'
        ? 'verified'
        : current.membershipStatus,
    remoteSummary: 'Son sync başarılı olarak işaretlendi.',
  }));

  return buildWorkspaceSyncSnapshot(session, entry);
}

export async function recordWorkspaceSyncPushResult(
  session: AuthSession | null,
  result: Pick<
    WorkspaceSyncRemotePushResult,
    'status' | 'summary' | 'lastSuccessfulSyncAt' | 'membershipStatus'
  >,
  options?: {
    advanceCursor?: boolean;
  },
) {
  const activeWorkspace = getAuthActiveWorkspace(session);

  if (!activeWorkspace) {
    throw new Error('Push sonucu işlemek için aktif çalışma alanı gerekli.');
  }

  const now = new Date().toISOString();
  const shouldAdvanceCursor = options?.advanceCursor !== false;
  const entry = await updateWorkspaceSyncEntry(activeWorkspace.id, (current) => ({
    ...current,
    lastCheckedAt: now,
    lastSuccessfulSyncAt:
      result.status === 'ready' && shouldAdvanceCursor
        ? result.lastSuccessfulSyncAt ?? now
        : current.lastSuccessfulSyncAt,
    lastStatus: result.status,
    lastError:
      result.status === 'error' || result.status === 'blocked'
        ? result.summary ?? current.lastError
        : null,
    membershipStatus: result.membershipStatus,
    remoteSummary: result.summary ?? current.remoteSummary,
  }));

  return buildWorkspaceSyncSnapshot(session, entry);
}

export const workspaceSyncService = {
  getWorkspaceSyncSnapshot,
  checkWorkspaceSyncReadiness,
  markWorkspaceSyncSuccess,
  getWorkspaceSyncModeLabel,
  getWorkspaceSyncStatusLabel,
  getWorkspaceSyncPendingLabel,
  getWorkspaceSyncMembershipLabel,
  recordWorkspaceSyncPushResult,
};
