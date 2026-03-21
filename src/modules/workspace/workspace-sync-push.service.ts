import { getDb } from '../../db/sqlite';
import {
  getAssetUsageCount,
  getAssetsByType,
  parseAssetMetadata,
  type StoredAsset,
} from '../assets/asset.service';
import { getAuthActiveWorkspace } from '../auth/auth.service';
import type { AuthSession } from '../auth/auth.types';
import {
  getDocumentDetail,
  type DocumentDetail,
  type DocumentPage,
} from '../documents/document.service';
import { getDocumentOverlays, type DocumentOverlay } from '../overlays/overlay.service';
import {
  getWorkspaceProfile,
  type WorkspaceProfile,
} from './workspace.service';
import {
  getWorkspaceSyncSnapshot,
  recordWorkspaceSyncPushResult,
  type WorkspaceSyncSnapshot,
} from './workspace-sync.service';
import {
  acknowledgeWorkspaceSyncTombstones,
  listWorkspaceSyncTombstones,
  type WorkspaceSyncTombstone,
} from './workspace-sync-tombstone.service';
import {
  runWorkspaceSyncRemotePush,
  type WorkspaceSyncRemotePushResult,
} from './workspace-sync-remote.service';

export type WorkspaceSyncPushDocumentPayload = {
  id: string;
  title: string;
  status: string;
  ocrStatus: string;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  tagNames: string[];
  collectionName: string | null;
  pages: Array<{
    id: string;
    pageOrder: number;
    width: number | null;
    height: number | null;
    createdAt: string;
    fileName: string | null;
  }>;
  overlays: Array<{
    id: string;
    pageId: string | null;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
    content: unknown;
    createdAt: string;
  }>;
  ocrText: string | null;
};

export type WorkspaceSyncPushAssetPayload = {
  id: string;
  type: string;
  name: string;
  scope: 'workspace' | 'personal';
  workspaceName: string | null;
  usageCount: number;
  createdAt: string;
  changedAt: string;
  fileName: string | null;
  previewFileName: string | null;
  originalFileName: string | null;
  metadata: Record<string, unknown>;
};

export type WorkspaceSyncPushWorkspaceProfilePayload = {
  companyName: string;
  branchName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSyncPushPayload = {
  generatedAt: string;
  workspace: {
    id: string;
    slug: string;
    name: string;
    role: string;
    isPersonal: boolean;
  };
  cursor: {
    lastSuccessfulSyncAt: string | null;
    lastLocalChangeAt: string | null;
  };
  snapshot: {
    documentCount: number;
    pageCount: number;
    workspaceStampCount: number;
    signatureCount: number;
    syncCandidateCount: number;
  };
  workspaceProfile: WorkspaceSyncPushWorkspaceProfilePayload | null;
  documents: WorkspaceSyncPushDocumentPayload[];
  assets: WorkspaceSyncPushAssetPayload[];
  tombstones: WorkspaceSyncTombstone[];
};

export type WorkspaceSyncPushRunResult = {
  pushed: boolean;
  summary: string;
  snapshot: WorkspaceSyncSnapshot;
  payloadCounts: {
    documents: number;
    assets: number;
    tombstones: number;
    workspaceProfile: number;
  };
};

function getFileName(value: string | null | undefined) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const normalized = value.trim().split('?')[0];
  const parts = normalized.split('/');
  return parts[parts.length - 1] || null;
}

function isChangedSince(value: string | null | undefined, since: string | null) {
  if (!since) {
    return true;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  return value > since;
}

function parseOverlayContent(content: string | null) {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    return content;
  }
}

function mapPagePayload(page: DocumentPage) {
  return {
    id: String(page.id),
    pageOrder: page.page_order,
    width: page.width,
    height: page.height,
    createdAt: page.created_at,
    fileName: getFileName(page.image_path),
  };
}

function mapOverlayPayload(overlay: DocumentOverlay) {
  return {
    id: String(overlay.id),
    pageId: overlay.page_id ? String(overlay.page_id) : null,
    type: overlay.type,
    x: overlay.x,
    y: overlay.y,
    width: overlay.width,
    height: overlay.height,
    rotation: overlay.rotation,
    opacity: overlay.opacity,
    content: parseOverlayContent(overlay.content),
    createdAt: overlay.created_at,
  };
}

function mapDocumentPayload(
  document: DocumentDetail,
  overlays: DocumentOverlay[],
): WorkspaceSyncPushDocumentPayload {
  return {
    id: String(document.id),
    title: document.title,
    status: document.status,
    ocrStatus: document.ocr_status,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
    pageCount: document.pages.length,
    tagNames: document.tag_names,
    collectionName: document.collection_name,
    pages: document.pages.map((page) => mapPagePayload(page)),
    overlays: overlays.map((overlay) => mapOverlayPayload(overlay)),
    ocrText: document.ocr_text,
  };
}

function getAssetChangedAt(asset: StoredAsset) {
  const metadata = parseAssetMetadata(asset.metadata);
  return typeof metadata.updatedAt === 'string' && metadata.updatedAt.trim().length > 0
    ? metadata.updatedAt
    : asset.created_at;
}

async function mapAssetPayload(asset: StoredAsset): Promise<WorkspaceSyncPushAssetPayload> {
  const metadata = parseAssetMetadata(asset.metadata);
  const usageCount = await getAssetUsageCount(asset.id);

  return {
    id: String(asset.id),
    type: asset.type,
    name: asset.name,
    scope: asset.library_scope,
    workspaceName: asset.workspace_name,
    usageCount,
    createdAt: asset.created_at,
    changedAt: getAssetChangedAt(asset),
    fileName: getFileName(asset.file_path),
    previewFileName: getFileName(asset.preview_file_path),
    originalFileName: getFileName(asset.original_file_path),
    metadata,
  };
}

async function getChangedDocumentIds(since: string | null) {
  const db = await getDb();

  const rows = since
    ? await db.getAllAsync<{ id: number }>(
        `
          SELECT id
          FROM documents
          WHERE updated_at > ?
          ORDER BY updated_at ASC, id ASC
        `,
        since,
      )
    : await db.getAllAsync<{ id: number }>(
        `
          SELECT id
          FROM documents
          ORDER BY updated_at ASC, id ASC
        `,
      );

  return rows.map((row) => row.id);
}

async function getChangedDocuments(
  since: string | null,
): Promise<WorkspaceSyncPushDocumentPayload[]> {
  const documentIds = await getChangedDocumentIds(since);

  return Promise.all(
    documentIds.map(async (documentId) => {
      const [document, overlays] = await Promise.all([
        getDocumentDetail(documentId),
        getDocumentOverlays(documentId),
      ]);

      return mapDocumentPayload(document, overlays);
    }),
  );
}

async function getChangedAssets(
  since: string | null,
): Promise<WorkspaceSyncPushAssetPayload[]> {
  const [workspaceStamps, signatures] = await Promise.all([
    getAssetsByType('stamp', { scope: 'workspace' }),
    getAssetsByType('signature'),
  ]);

  const changedAssets = [...workspaceStamps, ...signatures].filter((asset) =>
    isChangedSince(getAssetChangedAt(asset), since),
  );

  return Promise.all(changedAssets.map((asset) => mapAssetPayload(asset)));
}

function mapWorkspaceProfilePayload(
  profile: WorkspaceProfile | null,
): WorkspaceSyncPushWorkspaceProfilePayload | null {
  if (!profile) {
    return null;
  }

  return {
    companyName: profile.company_name,
    branchName: profile.branch_name,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

async function getChangedWorkspaceProfile(since: string | null) {
  const profile = await getWorkspaceProfile();

  if (!profile) {
    return null;
  }

  if (!isChangedSince(profile.updated_at, since)) {
    return null;
  }

  return mapWorkspaceProfilePayload(profile);
}

export async function prepareWorkspaceSyncPushPayload(
  session: AuthSession | null,
): Promise<WorkspaceSyncPushPayload> {
  const activeWorkspace = getAuthActiveWorkspace(session);

  if (!session?.accessToken || !activeWorkspace) {
    throw new Error('Push payload hazırlamak için aktif oturum ve çalışma alanı gerekli.');
  }

  const snapshot = await getWorkspaceSyncSnapshot(session);
  const since = snapshot.lastSuccessfulSyncAt;
  const [documents, assets, workspaceProfile, tombstones] = await Promise.all([
    getChangedDocuments(since),
    getChangedAssets(since),
    getChangedWorkspaceProfile(since),
    listWorkspaceSyncTombstones(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    workspace: {
      id: activeWorkspace.id,
      slug: activeWorkspace.slug,
      name: activeWorkspace.name,
      role: activeWorkspace.role,
      isPersonal: activeWorkspace.isPersonal,
    },
    cursor: {
      lastSuccessfulSyncAt: snapshot.lastSuccessfulSyncAt,
      lastLocalChangeAt: snapshot.lastLocalChangeAt,
    },
    snapshot: {
      documentCount: snapshot.documentCount,
      pageCount: snapshot.pageCount,
      workspaceStampCount: snapshot.workspaceStampCount,
      signatureCount: snapshot.signatureCount,
      syncCandidateCount: snapshot.syncCandidateCount,
    },
    workspaceProfile,
    documents,
    assets,
    tombstones,
  };
}

function createLocalSummary(payload: WorkspaceSyncPushPayload) {
  const parts = [
    payload.documents.length > 0 ? `${payload.documents.length} belge` : null,
    payload.assets.length > 0 ? `${payload.assets.length} asset` : null,
    payload.workspaceProfile ? 'çalışma alanı profili' : null,
    payload.tombstones.length > 0 ? `${payload.tombstones.length} silme kaydı` : null,
  ].filter(Boolean);

  return parts.length > 0 ? `${parts.join(', ')} push için hazır.` : 'Gönderilecek delta yok.';
}

export async function runWorkspaceSyncPush(
  session: AuthSession | null,
): Promise<WorkspaceSyncPushRunResult> {
  if (!session?.accessToken) {
    throw new Error('Push başlatmak için oturum gerekli.');
  }

  const payload = await prepareWorkspaceSyncPushPayload(session);
  const payloadCounts = {
    documents: payload.documents.length,
    assets: payload.assets.length,
    tombstones: payload.tombstones.length,
    workspaceProfile: payload.workspaceProfile ? 1 : 0,
  };

  if (
    payloadCounts.documents === 0 &&
    payloadCounts.assets === 0 &&
    payloadCounts.tombstones === 0 &&
    payloadCounts.workspaceProfile === 0
  ) {
    const summary = createLocalSummary(payload);
    const snapshot = await recordWorkspaceSyncPushResult(session, {
      status: 'ready',
      summary,
      lastSuccessfulSyncAt: null,
      membershipStatus: 'verified',
    });

    return {
      pushed: false,
      summary,
      snapshot,
      payloadCounts,
    };
  }

  const remoteResult: WorkspaceSyncRemotePushResult =
    await runWorkspaceSyncRemotePush({
      accessToken: session.accessToken,
      payload,
    });

  if (remoteResult.acknowledgedTombstoneIds.length > 0) {
    await acknowledgeWorkspaceSyncTombstones(remoteResult.acknowledgedTombstoneIds);
  }

  const snapshot = await recordWorkspaceSyncPushResult(session, remoteResult);

  return {
    pushed: remoteResult.status === 'ready',
    summary: remoteResult.summary ?? createLocalSummary(payload),
    snapshot,
    payloadCounts,
  };
}

export const workspaceSyncPushService = {
  prepareWorkspaceSyncPushPayload,
  runWorkspaceSyncPush,
};
