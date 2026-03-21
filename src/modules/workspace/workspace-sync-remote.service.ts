import { isCustomWorkspaceSyncConfigured, workspaceSyncRemoteRuntimeConfig } from './workspace-sync-remote-config.service';
import type {
  WorkspaceSyncPushAssetPayload,
  WorkspaceSyncPushDocumentPayload,
  WorkspaceSyncPushPayload,
  WorkspaceSyncPushWorkspaceProfilePayload,
} from './workspace-sync-push.service';
import type { WorkspaceSyncTombstone } from './workspace-sync-tombstone.service';
import type { WorkspaceSyncTransferEntityType } from './workspace-sync-transfer-queue.service';

export type WorkspaceSyncRemoteMembershipStatus =
  | 'unverified'
  | 'verified'
  | 'missing'
  | 'denied';

export type WorkspaceSyncRemoteStatus = 'ready' | 'blocked' | 'error';

export type WorkspaceSyncRemotePreflightInput = {
  accessToken: string;
  workspace: {
    id: string;
    slug: string;
    name: string;
    role: string;
    isPersonal: boolean;
  };
  inventory: {
    documentCount: number;
    pageCount: number;
    workspaceStampCount: number;
    personalStampCount: number;
    signatureCount: number;
    syncCandidateCount: number;
  };
  lastLocalChangeAt: string | null;
  lastSuccessfulSyncAt: string | null;
};

export type WorkspaceSyncRemotePreflightResult = {
  status: WorkspaceSyncRemoteStatus;
  membershipStatus: WorkspaceSyncRemoteMembershipStatus;
  summary: string | null;
  lastSuccessfulSyncAt: string | null;
};

export type WorkspaceSyncRemotePushInput = {
  accessToken: string;
  payload: WorkspaceSyncPushPayload;
};

export type WorkspaceSyncRemotePushResult = {
  status: WorkspaceSyncRemoteStatus;
  membershipStatus: WorkspaceSyncRemoteMembershipStatus;
  summary: string | null;
  lastSuccessfulSyncAt: string | null;
  acknowledgedTombstoneIds: string[];
};

export type WorkspaceSyncRemotePullInput = {
  accessToken: string;
  workspace: {
    id: string;
    slug: string;
    name: string;
  };
  cursor: {
    lastSuccessfulSyncAt: string | null;
    lastLocalChangeAt: string | null;
  };
};

export type WorkspaceSyncRemotePullFileTransfer = {
  id: string;
  entityType: WorkspaceSyncTransferEntityType;
  entityId: string;
  fileRole: string;
  fileName: string | null;
  downloadUrl: string;
};

export type WorkspaceSyncRemotePullResult = {
  status: WorkspaceSyncRemoteStatus;
  membershipStatus: WorkspaceSyncRemoteMembershipStatus;
  summary: string | null;
  lastSuccessfulSyncAt: string | null;
  workspaceProfile: WorkspaceSyncPushWorkspaceProfilePayload | null;
  documents: WorkspaceSyncPushDocumentPayload[];
  assets: WorkspaceSyncPushAssetPayload[];
  tombstones: WorkspaceSyncTombstone[];
  fileTransfers: WorkspaceSyncRemotePullFileTransfer[];
};

type RemoteMembershipPayload = {
  status?: string | null;
  role?: string | null;
  workspaceId?: string | number | null;
};

type RemoteSyncPayload = {
  status?: string | null;
  summary?: string | null;
  message?: string | null;
  lastSuccessfulSyncAt?: string | null;
};

type RemotePreflightEnvelope = {
  status?: string | null;
  summary?: string | null;
  message?: string | null;
  membership?: RemoteMembershipPayload | null;
  sync?: RemoteSyncPayload | null;
  lastSuccessfulSyncAt?: string | null;
  data?: {
    status?: string | null;
    summary?: string | null;
    message?: string | null;
    membership?: RemoteMembershipPayload | null;
    sync?: RemoteSyncPayload | null;
    lastSuccessfulSyncAt?: string | null;
  } | null;
};

type RemotePushEnvelope = {
  status?: string | null;
  summary?: string | null;
  message?: string | null;
  membership?: RemoteMembershipPayload | null;
  sync?: RemoteSyncPayload | null;
  lastSuccessfulSyncAt?: string | null;
  acknowledgedTombstoneIds?: string[] | null;
  data?: {
    status?: string | null;
    summary?: string | null;
    message?: string | null;
    membership?: RemoteMembershipPayload | null;
    sync?: RemoteSyncPayload | null;
    lastSuccessfulSyncAt?: string | null;
    acknowledgedTombstoneIds?: string[] | null;
  } | null;
};

type RemotePullFileTransferPayload = {
  id?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  fileRole?: string | null;
  fileName?: string | null;
  downloadUrl?: string | null;
  url?: string | null;
};

type RemotePullEnvelope = {
  status?: string | null;
  summary?: string | null;
  message?: string | null;
  membership?: RemoteMembershipPayload | null;
  sync?: RemoteSyncPayload | null;
  lastSuccessfulSyncAt?: string | null;
  workspaceProfile?: WorkspaceSyncPushWorkspaceProfilePayload | null;
  documents?: WorkspaceSyncPushDocumentPayload[] | null;
  assets?: WorkspaceSyncPushAssetPayload[] | null;
  tombstones?: WorkspaceSyncTombstone[] | null;
  fileTransfers?: RemotePullFileTransferPayload[] | null;
  files?: RemotePullFileTransferPayload[] | null;
  data?: {
    status?: string | null;
    summary?: string | null;
    message?: string | null;
    membership?: RemoteMembershipPayload | null;
    sync?: RemoteSyncPayload | null;
    lastSuccessfulSyncAt?: string | null;
    workspaceProfile?: WorkspaceSyncPushWorkspaceProfilePayload | null;
    documents?: WorkspaceSyncPushDocumentPayload[] | null;
    assets?: WorkspaceSyncPushAssetPayload[] | null;
    tombstones?: WorkspaceSyncTombstone[] | null;
    fileTransfers?: RemotePullFileTransferPayload[] | null;
    files?: RemotePullFileTransferPayload[] | null;
  } | null;
};

function assertRemoteSyncConfigured() {
  if (isCustomWorkspaceSyncConfigured()) {
    return;
  }

  throw new Error(
    'Custom sync runtime için EXPO_PUBLIC_SYNC_API_BASE_URL veya auth base URL yapılandırılmalı.',
  );
}

function buildUrl(path: string) {
  const baseUrl = workspaceSyncRemoteRuntimeConfig.baseUrl;

  if (!baseUrl) {
    throw new Error('Custom sync runtime temel adresi eksik.');
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}${path}`;
}

async function fetchJson<T>(path: string, init: RequestInit): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Uzak sync isteği zaman aşımına uğradı.'));
    }, workspaceSyncRemoteRuntimeConfig.requestTimeoutMs);
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

    throw new Error(message || 'Uzak sync sağlayıcısı isteği başarısız oldu.');
  }

  return payload as T;
}

function normalizeStatus(
  value: string | null | undefined,
  membershipStatus?: WorkspaceSyncRemoteMembershipStatus,
): WorkspaceSyncRemoteStatus {
  switch (value) {
    case 'ready':
    case 'blocked':
    case 'error':
      return value;
    default:
      return membershipStatus === 'missing' || membershipStatus === 'denied'
        ? 'blocked'
        : 'ready';
  }
}

function normalizeMembershipStatus(
  value: string | null | undefined,
): WorkspaceSyncRemoteMembershipStatus {
  switch (value) {
    case 'verified':
    case 'missing':
    case 'denied':
    case 'unverified':
      return value;
    default:
      return 'verified';
  }
}

function normalizeIsoDate(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildHeaders(accessToken: string) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeAcknowledgedTombstoneIds(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeRemotePullEntityType(
  value: string | null | undefined,
): WorkspaceSyncTransferEntityType | null {
  switch (value) {
    case 'asset':
    case 'document_page':
    case 'document_pdf':
    case 'document_thumbnail':
      return value;
    default:
      return null;
  }
}

function normalizeDownloadUrl(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const baseUrl = workspaceSyncRemoteRuntimeConfig.baseUrl;

  if (!baseUrl) {
    return null;
  }

  if (normalized.startsWith('/')) {
    return `${baseUrl}${normalized}`;
  }

  return `${baseUrl}/${normalized}`;
}

function normalizeRemotePullFileTransfers(
  value: RemotePullFileTransferPayload[] | null | undefined,
): WorkspaceSyncRemotePullFileTransfer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const entityType = normalizeRemotePullEntityType(item.entityType);
      const entityId =
        typeof item.entityId === 'string' || typeof item.entityId === 'number'
          ? String(item.entityId)
          : null;
      const fileRole =
        typeof item.fileRole === 'string' && item.fileRole.trim().length > 0
          ? item.fileRole.trim()
          : null;
      const downloadUrl = normalizeDownloadUrl(item.downloadUrl ?? item.url);

      if (!entityType || !entityId || !fileRole || !downloadUrl) {
        return null;
      }

      const id =
        typeof item.id === 'string' && item.id.trim().length > 0
          ? item.id.trim()
          : `${entityType}:${entityId}:${fileRole}:${index + 1}`;

      return {
        id,
        entityType,
        entityId,
        fileRole,
        fileName:
          typeof item.fileName === 'string' && item.fileName.trim().length > 0
            ? item.fileName.trim()
            : null,
        downloadUrl,
      } satisfies WorkspaceSyncRemotePullFileTransfer;
    })
    .filter(Boolean) as WorkspaceSyncRemotePullFileTransfer[];
}

export async function runWorkspaceSyncRemotePreflight(
  input: WorkspaceSyncRemotePreflightInput,
): Promise<WorkspaceSyncRemotePreflightResult> {
  assertRemoteSyncConfigured();

  const response = await fetchJson<RemotePreflightEnvelope>(
    workspaceSyncRemoteRuntimeConfig.preflightPath,
    {
      method: 'POST',
      headers: buildHeaders(input.accessToken),
      body: JSON.stringify({
        workspace: input.workspace,
        inventory: input.inventory,
        cursor: {
          lastLocalChangeAt: input.lastLocalChangeAt,
          lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
        },
      }),
    },
  );

  const candidate = response.data ?? response;
  const remoteSync = candidate.sync ?? null;
  const summaryCandidate =
    candidate.summary ??
    remoteSync?.summary ??
    candidate.message ??
    remoteSync?.message ??
    null;
  const membershipStatus = candidate.membership?.status
    ? normalizeMembershipStatus(candidate.membership.status)
    : 'unverified';

  return {
    status: normalizeStatus(candidate.status ?? remoteSync?.status, membershipStatus),
    membershipStatus,
    summary:
      typeof summaryCandidate === 'string' && summaryCandidate.trim().length > 0
        ? summaryCandidate.trim()
        : null,
    lastSuccessfulSyncAt: normalizeIsoDate(
      remoteSync?.lastSuccessfulSyncAt ?? candidate.lastSuccessfulSyncAt,
    ),
  };
}

export async function runWorkspaceSyncRemotePush(
  input: WorkspaceSyncRemotePushInput,
): Promise<WorkspaceSyncRemotePushResult> {
  assertRemoteSyncConfigured();

  const response = await fetchJson<RemotePushEnvelope>(
    workspaceSyncRemoteRuntimeConfig.pushPath,
    {
      method: 'POST',
      headers: buildHeaders(input.accessToken),
      body: JSON.stringify(input.payload),
    },
  );

  const candidate = response.data ?? response;
  const remoteSync = candidate.sync ?? null;
  const membershipStatus = candidate.membership?.status
    ? normalizeMembershipStatus(candidate.membership.status)
    : 'verified';
  const summaryCandidate =
    candidate.summary ??
    remoteSync?.summary ??
    candidate.message ??
    remoteSync?.message ??
    null;

  return {
    status: normalizeStatus(candidate.status ?? remoteSync?.status, membershipStatus),
    membershipStatus,
    summary:
      typeof summaryCandidate === 'string' && summaryCandidate.trim().length > 0
        ? summaryCandidate.trim()
        : null,
    lastSuccessfulSyncAt: normalizeIsoDate(
      remoteSync?.lastSuccessfulSyncAt ?? candidate.lastSuccessfulSyncAt,
    ),
    acknowledgedTombstoneIds: normalizeAcknowledgedTombstoneIds(
      candidate.acknowledgedTombstoneIds,
    ),
  };
}

export async function runWorkspaceSyncRemotePull(
  input: WorkspaceSyncRemotePullInput,
): Promise<WorkspaceSyncRemotePullResult> {
  assertRemoteSyncConfigured();

  const response = await fetchJson<RemotePullEnvelope>(
    workspaceSyncRemoteRuntimeConfig.pullPath,
    {
      method: 'POST',
      headers: buildHeaders(input.accessToken),
      body: JSON.stringify({
        workspace: input.workspace,
        cursor: input.cursor,
      }),
    },
  );

  const candidate = response.data ?? response;
  const remoteSync = candidate.sync ?? null;
  const membershipStatus = candidate.membership?.status
    ? normalizeMembershipStatus(candidate.membership.status)
    : 'verified';
  const summaryCandidate =
    candidate.summary ??
    remoteSync?.summary ??
    candidate.message ??
    remoteSync?.message ??
    null;

  return {
    status: normalizeStatus(candidate.status ?? remoteSync?.status, membershipStatus),
    membershipStatus,
    summary:
      typeof summaryCandidate === 'string' && summaryCandidate.trim().length > 0
        ? summaryCandidate.trim()
        : null,
    lastSuccessfulSyncAt: normalizeIsoDate(
      remoteSync?.lastSuccessfulSyncAt ?? candidate.lastSuccessfulSyncAt,
    ),
    workspaceProfile: candidate.workspaceProfile ?? null,
    documents: Array.isArray(candidate.documents) ? candidate.documents : [],
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
    tombstones: Array.isArray(candidate.tombstones) ? candidate.tombstones : [],
    fileTransfers: normalizeRemotePullFileTransfers(
      candidate.fileTransfers ?? candidate.files,
    ),
  };
}
