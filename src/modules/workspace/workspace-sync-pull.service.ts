import { getDb } from '../../db/sqlite';
import {
  getAssetUsageCount,
  getAssetsByType,
  parseAssetMetadata,
  type StoredAsset,
} from '../assets/asset.service';
import { getAuthActiveWorkspace } from '../auth/auth.service';
import type { AuthSession } from '../auth/auth.types';
import { syncDocumentTaxonomy } from '../documents/document-taxonomy.service';
import {
  downloadAssetFile,
  downloadPdfFile,
  downloadScanFile,
  downloadThumbnailFile,
  fileExists,
  removeFilesIfExist,
} from '../storage/file.service';
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
  runWorkspaceSyncRemotePull,
  type WorkspaceSyncRemotePullFileTransfer,
  type WorkspaceSyncRemotePullResult,
} from './workspace-sync-remote.service';
import {
  type WorkspaceSyncPushAssetPayload,
  type WorkspaceSyncPushDocumentPayload,
  type WorkspaceSyncPushWorkspaceProfilePayload,
} from './workspace-sync-push.service';
import {
  buildWorkspaceSyncTransferTaskId,
  countPendingWorkspaceSyncTransfers,
  listWorkspaceSyncTransferTasks,
  updateWorkspaceSyncTransferTaskStatus,
  upsertWorkspaceSyncTransferTasks,
  type WorkspaceSyncTransferTask,
} from './workspace-sync-transfer-queue.service';

export type WorkspaceSyncPullDecisionAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'conflict'
  | 'skip';

export type WorkspaceSyncPullConflictResolution = 'accept_remote' | 'keep_local';

export type WorkspaceSyncPullConflictKind =
  | 'remote_newer_than_local'
  | 'remote_delete_vs_local_change'
  | 'local_newer_than_remote';

export type WorkspaceSyncPullConflictItem = {
  id: string;
  entityType: 'document' | 'asset' | 'workspace_profile';
  entityId: string;
  label: string;
  kind: WorkspaceSyncPullConflictKind;
  localChangedAt: string | null;
  remoteChangedAt: string | null;
};

export type WorkspaceSyncPullConflictResolutionMap = Record<
  string,
  WorkspaceSyncPullConflictResolution
>;

export type WorkspaceSyncPullPreview = {
  summary: string;
  snapshot: WorkspaceSyncSnapshot;
  decisionCounts: {
    create: number;
    update: number;
    delete: number;
    conflict: number;
    skip: number;
  };
  remoteCounts: {
    documents: number;
    assets: number;
    tombstones: number;
    fileTransfers: number;
    workspaceProfile: number;
  };
  pendingTransferCount: number;
  conflicts: WorkspaceSyncPullConflictItem[];
};

export type WorkspaceSyncPullApplyResult = {
  applied: boolean;
  summary: string;
  snapshot: WorkspaceSyncSnapshot;
  appliedCounts: {
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
    downloaded: number;
    retainedLocal: number;
  };
  conflictCount: number;
  pendingTransferCount: number;
};

type LocalDocumentIndexItem = {
  id: string;
  title: string;
  updatedAt: string;
};

type LocalAssetIndexItem = {
  id: string;
  name: string;
  changedAt: string;
  asset: StoredAsset;
};

type DecisionAccumulator = WorkspaceSyncPullPreview['decisionCounts'];

type PullPlan = {
  activeWorkspace: NonNullable<ReturnType<typeof getAuthActiveWorkspace>>;
  snapshot: WorkspaceSyncSnapshot;
  remoteResult: WorkspaceSyncRemotePullResult;
  decisionCounts: DecisionAccumulator;
  conflicts: WorkspaceSyncPullConflictItem[];
  pendingTransferCount: number;
  summary: string;
  documentActions: Map<string, WorkspaceSyncPullDecisionAction>;
  assetActions: Map<string, WorkspaceSyncPullDecisionAction>;
  workspaceProfileAction: WorkspaceSyncPullDecisionAction | null;
  tombstoneActions: Array<{
    entityType: 'document' | 'asset';
    entityId: string;
    label: string;
    action: WorkspaceSyncPullDecisionAction;
  }>;
};

type DownloadedTransferMap = Map<string, string>;

const REMOTE_PULL_DOWNLOAD_HEADERS_ACCEPT = {
  Accept: '*/*',
} as const;

function createDecisionAccumulator(): DecisionAccumulator {
  return {
    create: 0,
    update: 0,
    delete: 0,
    conflict: 0,
    skip: 0,
  };
}

function countDecision(
  counts: DecisionAccumulator,
  action: WorkspaceSyncPullDecisionAction,
) {
  counts[action] += 1;
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

function getAssetChangedAt(asset: StoredAsset) {
  const metadata = parseAssetMetadata(asset.metadata);
  return typeof metadata.updatedAt === 'string' && metadata.updatedAt.trim().length > 0
    ? metadata.updatedAt
    : asset.created_at;
}

function normalizeOptionalString(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toTransferKey(
  entityType: WorkspaceSyncRemotePullFileTransfer['entityType'],
  entityId: string,
  fileRole: string,
) {
  return `${entityType}:${entityId}:${fileRole}`;
}

function parsePositiveIntegerId(value: string, fallbackLabel: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fallbackLabel} için geçerli sayısal kimlik bulunamadı.`);
  }

  return parsed;
}

function serializeOverlayContent(content: unknown) {
  if (content === null || content === undefined) {
    return null;
  }

  if (typeof content === 'string') {
    return content;
  }

  try {
    return JSON.stringify(content);
  } catch {
    return null;
  }
}

async function getLocalDocumentIndex() {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    title: string;
    updated_at: string;
  }>(
    `
      SELECT
        id,
        title,
        updated_at
      FROM documents
    `,
  );

  return new Map<string, LocalDocumentIndexItem>(
    rows.map((row) => [
      String(row.id),
      {
        id: String(row.id),
        title: row.title,
        updatedAt: row.updated_at,
      },
    ]),
  );
}

async function getLocalAssetIndex() {
  const [workspaceStamps, signatures] = await Promise.all([
    getAssetsByType('stamp', { scope: 'workspace' }),
    getAssetsByType('signature'),
  ]);

  return new Map<string, LocalAssetIndexItem>(
    [...workspaceStamps, ...signatures].map((asset) => [
      String(asset.id),
      {
        id: String(asset.id),
        name: asset.name,
        changedAt: getAssetChangedAt(asset),
        asset,
      },
    ]),
  );
}

function classifyRemoteRecord(params: {
  localChangedAt: string | null;
  remoteChangedAt: string | null;
  since: string | null;
}): WorkspaceSyncPullDecisionAction {
  const { localChangedAt, remoteChangedAt, since } = params;

  if (!localChangedAt) {
    return 'create';
  }

  if (!remoteChangedAt) {
    return 'skip';
  }

  const localChanged = isChangedSince(localChangedAt, since);
  const remoteChanged = isChangedSince(remoteChangedAt, since);

  if (remoteChanged && localChanged) {
    return 'conflict';
  }

  if (remoteChanged && remoteChangedAt > localChangedAt) {
    return 'update';
  }

  if (!remoteChanged && localChanged) {
    return 'skip';
  }

  return remoteChangedAt > localChangedAt ? 'update' : 'skip';
}

function getConflictKind(
  localChangedAt: string | null,
  remoteChangedAt: string | null,
): WorkspaceSyncPullConflictKind {
  if (!localChangedAt || !remoteChangedAt) {
    return 'remote_newer_than_local';
  }

  return remoteChangedAt >= localChangedAt
    ? 'remote_newer_than_local'
    : 'local_newer_than_remote';
}

export function buildWorkspaceSyncPullConflictId(
  entityType: WorkspaceSyncPullConflictItem['entityType'],
  entityId: string,
) {
  return `${entityType}:${entityId}`;
}

function getConflictResolution(
  conflictResolutions: WorkspaceSyncPullConflictResolutionMap,
  entityType: WorkspaceSyncPullConflictItem['entityType'],
  entityId: string,
) {
  return (
    conflictResolutions[buildWorkspaceSyncPullConflictId(entityType, entityId)] ?? null
  );
}

function resolveConflictAction(params: {
  action: WorkspaceSyncPullDecisionAction;
  resolution: WorkspaceSyncPullConflictResolution | null;
  remoteResolutionAction: Extract<WorkspaceSyncPullDecisionAction, 'update' | 'delete'>;
}) {
  const { action, resolution, remoteResolutionAction } = params;

  if (action !== 'conflict') {
    return action;
  }

  if (!resolution) {
    return 'conflict';
  }

  return resolution === 'accept_remote' ? remoteResolutionAction : 'skip';
}

function pushConflict(
  conflicts: WorkspaceSyncPullConflictItem[],
  item: WorkspaceSyncPullConflictItem,
) {
  conflicts.push(item);
}

function buildPreviewSummary(
  counts: DecisionAccumulator,
  pendingTransferCount: number,
  remoteResult: WorkspaceSyncRemotePullResult,
) {
  const parts = [
    counts.create > 0 ? `${counts.create} oluşturma` : null,
    counts.update > 0 ? `${counts.update} güncelleme` : null,
    counts.delete > 0 ? `${counts.delete} silme` : null,
    counts.conflict > 0 ? `${counts.conflict} çatışma` : null,
    pendingTransferCount > 0 ? `${pendingTransferCount} dosya indirimi` : null,
  ].filter(Boolean);

  if (remoteResult.summary) {
    return remoteResult.summary;
  }

  return parts.length > 0 ? `${parts.join(', ')} bulundu.` : 'Uzak tarafta yeni delta görünmüyor.';
}

async function queueRemotePullTransfers(
  workspaceId: string,
  transfers: WorkspaceSyncRemotePullFileTransfer[],
) {
  if (transfers.length > 0) {
    await upsertWorkspaceSyncTransferTasks(
      transfers.map((task) => ({
        workspaceId,
        entityType: task.entityType,
        entityId: task.entityId,
        fileRole: task.fileRole,
        fileName: task.fileName,
        downloadUrl: task.downloadUrl,
        status: 'pending',
        enqueuedAt: new Date().toISOString(),
        attemptCount: 0,
        lastAttemptAt: null,
        localUri: null,
        completedAt: null,
        lastError: null,
      })),
    );
  }

  return countPendingWorkspaceSyncTransfers(workspaceId);
}

async function buildPullPlan(
  session: AuthSession | null,
  conflictResolutions: WorkspaceSyncPullConflictResolutionMap = {},
): Promise<PullPlan> {
  const activeWorkspace = getAuthActiveWorkspace(session);

  if (!session?.accessToken || !activeWorkspace) {
    throw new Error('Pull işlemi için aktif oturum ve çalışma alanı gerekli.');
  }

  const snapshot = await getWorkspaceSyncSnapshot(session);
  const remoteResult = await runWorkspaceSyncRemotePull({
    accessToken: session.accessToken,
    workspace: {
      id: activeWorkspace.id,
      slug: activeWorkspace.slug,
      name: activeWorkspace.name,
    },
    cursor: {
      lastSuccessfulSyncAt: snapshot.lastSuccessfulSyncAt,
      lastLocalChangeAt: snapshot.lastLocalChangeAt,
    },
  });

  const [localDocuments, localAssets, localProfile] = await Promise.all([
    getLocalDocumentIndex(),
    getLocalAssetIndex(),
    getWorkspaceProfile(),
  ]);

  const counts = createDecisionAccumulator();
  const conflicts: WorkspaceSyncPullConflictItem[] = [];
  const since = snapshot.lastSuccessfulSyncAt;
  const documentActions = new Map<string, WorkspaceSyncPullDecisionAction>();
  const assetActions = new Map<string, WorkspaceSyncPullDecisionAction>();
  const tombstoneActions: PullPlan['tombstoneActions'] = [];

  for (const remoteDocument of remoteResult.documents) {
    const localDocument = localDocuments.get(remoteDocument.id);
    const classifiedAction = classifyRemoteRecord({
      localChangedAt: localDocument?.updatedAt ?? null,
      remoteChangedAt: remoteDocument.updatedAt,
      since,
    });
    const action = resolveConflictAction({
      action: classifiedAction,
      resolution: getConflictResolution(
        conflictResolutions,
        'document',
        remoteDocument.id,
      ),
      remoteResolutionAction: 'update',
    });

    documentActions.set(remoteDocument.id, action);
    countDecision(counts, action);

    if (classifiedAction === 'conflict' && action === 'conflict') {
      pushConflict(conflicts, {
        id: buildWorkspaceSyncPullConflictId('document', remoteDocument.id),
        entityType: 'document',
        entityId: remoteDocument.id,
        label: remoteDocument.title,
        kind: getConflictKind(localDocument?.updatedAt ?? null, remoteDocument.updatedAt),
        localChangedAt: localDocument?.updatedAt ?? null,
        remoteChangedAt: remoteDocument.updatedAt,
      });
    }
  }

  for (const remoteAsset of remoteResult.assets) {
    const localAsset = localAssets.get(remoteAsset.id);
    const classifiedAction = classifyRemoteRecord({
      localChangedAt: localAsset?.changedAt ?? null,
      remoteChangedAt: remoteAsset.changedAt,
      since,
    });
    const action = resolveConflictAction({
      action: classifiedAction,
      resolution: getConflictResolution(conflictResolutions, 'asset', remoteAsset.id),
      remoteResolutionAction: 'update',
    });

    assetActions.set(remoteAsset.id, action);
    countDecision(counts, action);

    if (classifiedAction === 'conflict' && action === 'conflict') {
      pushConflict(conflicts, {
        id: buildWorkspaceSyncPullConflictId('asset', remoteAsset.id),
        entityType: 'asset',
        entityId: remoteAsset.id,
        label: remoteAsset.name,
        kind: getConflictKind(localAsset?.changedAt ?? null, remoteAsset.changedAt),
        localChangedAt: localAsset?.changedAt ?? null,
        remoteChangedAt: remoteAsset.changedAt,
      });
    }
  }

  let workspaceProfileAction: WorkspaceSyncPullDecisionAction | null = null;

  if (remoteResult.workspaceProfile) {
    const classifiedAction = classifyRemoteRecord({
      localChangedAt: localProfile?.updated_at ?? null,
      remoteChangedAt: remoteResult.workspaceProfile.updatedAt,
      since,
    });
    workspaceProfileAction = resolveConflictAction({
      action: classifiedAction,
      resolution: getConflictResolution(conflictResolutions, 'workspace_profile', 'active'),
      remoteResolutionAction: 'update',
    });

    countDecision(counts, workspaceProfileAction);

    if (classifiedAction === 'conflict' && workspaceProfileAction === 'conflict') {
      pushConflict(conflicts, {
        id: buildWorkspaceSyncPullConflictId('workspace_profile', 'active'),
        entityType: 'workspace_profile',
        entityId: 'active',
        label: remoteResult.workspaceProfile.branchName
          ? `${remoteResult.workspaceProfile.companyName} / ${remoteResult.workspaceProfile.branchName}`
          : remoteResult.workspaceProfile.companyName,
        kind: getConflictKind(
          localProfile?.updated_at ?? null,
          remoteResult.workspaceProfile.updatedAt,
        ),
        localChangedAt: localProfile?.updated_at ?? null,
        remoteChangedAt: remoteResult.workspaceProfile.updatedAt,
      });
    }
  }

  for (const tombstone of remoteResult.tombstones) {
    if (tombstone.entityType === 'document') {
      const localDocument = localDocuments.get(tombstone.entityId);
      const classifiedAction =
        !localDocument
          ? 'skip'
          : isChangedSince(localDocument.updatedAt, since)
            ? 'conflict'
            : 'delete';
      const action = resolveConflictAction({
        action: classifiedAction,
        resolution: getConflictResolution(
          conflictResolutions,
          'document',
          tombstone.entityId,
        ),
        remoteResolutionAction: 'delete',
      });

      tombstoneActions.push({
        entityType: 'document',
        entityId: tombstone.entityId,
        label:
          tombstone.entityName ?? localDocument?.title ?? `Belge ${tombstone.entityId}`,
        action,
      });
      countDecision(counts, action);

      if (classifiedAction === 'conflict' && action === 'conflict') {
        pushConflict(conflicts, {
          id: buildWorkspaceSyncPullConflictId('document', tombstone.entityId),
          entityType: 'document',
          entityId: tombstone.entityId,
          label:
            tombstone.entityName ?? localDocument?.title ?? `Belge ${tombstone.entityId}`,
          kind: 'remote_delete_vs_local_change',
          localChangedAt: localDocument?.updatedAt ?? null,
          remoteChangedAt: tombstone.deletedAt,
        });
      }
      continue;
    }

    if (tombstone.entityType === 'asset') {
      const localAsset = localAssets.get(tombstone.entityId);
      const classifiedAction =
        !localAsset
          ? 'skip'
          : isChangedSince(localAsset.changedAt, since)
            ? 'conflict'
            : 'delete';
      const action = resolveConflictAction({
        action: classifiedAction,
        resolution: getConflictResolution(conflictResolutions, 'asset', tombstone.entityId),
        remoteResolutionAction: 'delete',
      });

      tombstoneActions.push({
        entityType: 'asset',
        entityId: tombstone.entityId,
        label:
          tombstone.entityName ?? localAsset?.name ?? `Asset ${tombstone.entityId}`,
        action,
      });
      countDecision(counts, action);

      if (classifiedAction === 'conflict' && action === 'conflict') {
        pushConflict(conflicts, {
          id: buildWorkspaceSyncPullConflictId('asset', tombstone.entityId),
          entityType: 'asset',
          entityId: tombstone.entityId,
          label:
            tombstone.entityName ?? localAsset?.name ?? `Asset ${tombstone.entityId}`,
          kind: 'remote_delete_vs_local_change',
          localChangedAt: localAsset?.changedAt ?? null,
          remoteChangedAt: tombstone.deletedAt,
        });
      }
    }
  }

  const pendingTransferCount = await queueRemotePullTransfers(
    activeWorkspace.id,
    remoteResult.fileTransfers,
  );
  const nextSnapshot = await recordWorkspaceSyncPushResult(session, remoteResult, {
    advanceCursor: false,
  });

  return {
    activeWorkspace,
    snapshot: nextSnapshot,
    remoteResult,
    decisionCounts: counts,
    conflicts,
    pendingTransferCount,
    summary: buildPreviewSummary(counts, pendingTransferCount, remoteResult),
    documentActions,
    assetActions,
    workspaceProfileAction,
    tombstoneActions,
  };
}

function buildDownloadHeaders(accessToken: string) {
  return {
    ...REMOTE_PULL_DOWNLOAD_HEADERS_ACCEPT,
    Authorization: `Bearer ${accessToken}`,
  };
}

function shouldDownloadTransfer(
  transfer: WorkspaceSyncRemotePullFileTransfer,
  plan: PullPlan,
  pageActionMap: Map<string, WorkspaceSyncPullDecisionAction>,
) {
  if (transfer.entityType === 'asset') {
    const action = plan.assetActions.get(transfer.entityId);
    return action === 'create' || action === 'update';
  }

  if (transfer.entityType === 'document_page') {
    const action = pageActionMap.get(transfer.entityId);
    return action === 'create' || action === 'update';
  }

  if (
    transfer.entityType === 'document_pdf' ||
    transfer.entityType === 'document_thumbnail'
  ) {
    const action = plan.documentActions.get(transfer.entityId);
    return action === 'create' || action === 'update';
  }

  return false;
}

async function downloadApplicableTransfers(
  session: AuthSession,
  plan: PullPlan,
): Promise<{
  transferMap: DownloadedTransferMap;
  downloadedCount: number;
}> {
  const pageActionMap = new Map<string, WorkspaceSyncPullDecisionAction>();

  for (const document of plan.remoteResult.documents) {
    const action = plan.documentActions.get(document.id);

    if (action === 'create' || action === 'update') {
      for (const page of document.pages) {
        pageActionMap.set(page.id, action);
      }
    }
  }

  const queuedTasks = await listWorkspaceSyncTransferTasks(plan.activeWorkspace.id);
  const taskMap = new Map<string, WorkspaceSyncTransferTask>(
    queuedTasks.map((task) => [task.id, task]),
  );
  const transferMap: DownloadedTransferMap = new Map();
  let downloadedCount = 0;

  for (const transfer of plan.remoteResult.fileTransfers) {
    if (!shouldDownloadTransfer(transfer, plan, pageActionMap)) {
      continue;
    }

    const taskId = buildWorkspaceSyncTransferTaskId({
      workspaceId: plan.activeWorkspace.id,
      entityType: transfer.entityType,
      entityId: transfer.entityId,
      fileRole: transfer.fileRole,
      downloadUrl: transfer.downloadUrl,
    });
    const existingTask = taskMap.get(taskId);
    const transferKey = toTransferKey(
      transfer.entityType,
      transfer.entityId,
      transfer.fileRole,
    );

    if (
      existingTask?.status === 'completed' &&
      existingTask.localUri &&
      (await fileExists(existingTask.localUri))
    ) {
      transferMap.set(transferKey, existingTask.localUri);
      continue;
    }

    try {
      const headers = buildDownloadHeaders(session.accessToken);
      let downloaded:
        | {
            uri: string;
          }
        | null = null;

      switch (transfer.entityType) {
        case 'asset':
          downloaded = await downloadAssetFile(
            transfer.downloadUrl,
            transfer.fileName,
            headers,
          );
          break;
        case 'document_page':
          downloaded = await downloadScanFile(
            transfer.downloadUrl,
            transfer.fileName,
            headers,
          );
          break;
        case 'document_thumbnail':
          downloaded = await downloadThumbnailFile(
            transfer.downloadUrl,
            transfer.fileName,
            headers,
          );
          break;
        case 'document_pdf':
          downloaded = await downloadPdfFile(
            transfer.downloadUrl,
            transfer.fileName,
            headers,
          );
          break;
        default:
          downloaded = null;
      }

      if (!downloaded?.uri) {
        continue;
      }

      transferMap.set(transferKey, downloaded.uri);
      downloadedCount += 1;

      await updateWorkspaceSyncTransferTaskStatus({
        id: taskId,
        status: 'completed',
        localUri: downloaded.uri,
        completedAt: new Date().toISOString(),
        lastError: null,
      });
    } catch (error) {
      await updateWorkspaceSyncTransferTaskStatus({
        id: taskId,
        status: 'failed',
        completedAt: new Date().toISOString(),
        lastError:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Dosya indirilemedi.',
      });
    }
  }

  return {
    transferMap,
    downloadedCount,
  };
}

function getTransferredUri(
  transferMap: DownloadedTransferMap,
  entityType: WorkspaceSyncRemotePullFileTransfer['entityType'],
  entityId: string,
  fileRole: string,
) {
  return transferMap.get(toTransferKey(entityType, entityId, fileRole)) ?? null;
}

function pickTransferredUri(
  transferMap: DownloadedTransferMap,
  entityType: WorkspaceSyncRemotePullFileTransfer['entityType'],
  entityId: string,
  preferredRoles: string[],
) {
  for (const role of preferredRoles) {
    const matched = getTransferredUri(transferMap, entityType, entityId, role);

    if (matched) {
      return matched;
    }
  }

  return null;
}

async function getExistingDocumentRecord(documentId: number) {
  const db = await getDb();

  return db.getFirstAsync<{
    id: number;
    pdf_path: string | null;
    thumbnail_path: string | null;
    word_path: string | null;
    is_favorite: number;
  }>(
    `
      SELECT
        id,
        pdf_path,
        thumbnail_path,
        word_path,
        COALESCE(is_favorite, 0) AS is_favorite
      FROM documents
      WHERE id = ?
    `,
    documentId,
  );
}

async function getExistingDocumentPages(documentId: number) {
  const db = await getDb();

  return db.getAllAsync<{
    id: number;
    image_path: string | null;
  }>(
    `
      SELECT
        id,
        image_path
      FROM document_pages
      WHERE document_id = ?
    `,
    documentId,
  );
}

async function getExistingAssetRecord(assetId: number) {
  const db = await getDb();

  return db.getFirstAsync<{
    id: number;
    file_path: string | null;
    original_file_path: string | null;
    preview_file_path: string | null;
  }>(
    `
      SELECT
        id,
        file_path,
        original_file_path,
        preview_file_path
      FROM assets
      WHERE id = ?
    `,
    assetId,
  );
}

async function applyWorkspaceProfile(
  profile: WorkspaceSyncPushWorkspaceProfilePayload,
) {
  const db = await getDb();
  const existing = await getWorkspaceProfile();

  if (existing) {
    await db.runAsync(
      `
        UPDATE workspace_profiles
        SET
          company_name = ?,
          branch_name = ?,
          updated_at = ?
        WHERE id = ?
      `,
      profile.companyName,
      profile.branchName,
      profile.updatedAt,
      1,
    );
    return;
  }

  await db.runAsync(
    `
      INSERT INTO workspace_profiles (
        id,
        company_name,
        branch_name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    1,
    profile.companyName,
    profile.branchName,
    profile.createdAt,
    profile.updatedAt,
  );
}

async function markWorkspaceProfileForResync() {
  const db = await getDb();
  const existing = await getWorkspaceProfile();

  if (!existing) {
    return false;
  }

  await db.runAsync(
    `
      UPDATE workspace_profiles
      SET updated_at = ?
      WHERE id = ?
    `,
    new Date().toISOString(),
    existing.id,
  );

  return true;
}

async function applyRemoteAsset(
  remoteAsset: WorkspaceSyncPushAssetPayload,
  transferMap: DownloadedTransferMap,
) {
  const assetId = parsePositiveIntegerId(remoteAsset.id, 'Asset');
  const existing = await getExistingAssetRecord(assetId);
  const mainUri =
    pickTransferredUri(transferMap, 'asset', remoteAsset.id, [
      'main',
      'file',
      'image',
      'active',
    ]) ?? existing?.file_path ?? null;

  if (!mainUri) {
    return false;
  }

  const previewUri =
    pickTransferredUri(transferMap, 'asset', remoteAsset.id, [
      'preview',
      'thumb',
      'thumbnail',
    ]) ??
    existing?.preview_file_path ??
    mainUri;
  const originalUri =
    pickTransferredUri(transferMap, 'asset', remoteAsset.id, ['original']) ??
    existing?.original_file_path ??
    mainUri;
  const db = await getDb();
  const metadata = JSON.stringify({
    ...remoteAsset.metadata,
    updatedAt: remoteAsset.changedAt,
    syncedAt: new Date().toISOString(),
  });

  if (existing?.id) {
    await db.runAsync(
      `
        UPDATE assets
        SET
          type = ?,
          name = ?,
          file_path = ?,
          original_file_path = ?,
          preview_file_path = ?,
          library_scope = ?,
          workspace_name = ?,
          metadata = ?,
          created_at = ?
        WHERE id = ?
      `,
      remoteAsset.type,
      remoteAsset.name,
      mainUri,
      originalUri,
      previewUri,
      remoteAsset.scope,
      remoteAsset.workspaceName,
      metadata,
      remoteAsset.createdAt,
      assetId,
    );
  } else {
    await db.runAsync(
      `
        INSERT INTO assets (
          id,
          type,
          name,
          file_path,
          original_file_path,
          preview_file_path,
          library_scope,
          workspace_name,
          metadata,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      assetId,
      remoteAsset.type,
      remoteAsset.name,
      mainUri,
      originalUri,
      previewUri,
      remoteAsset.scope,
      remoteAsset.workspaceName,
      metadata,
      remoteAsset.createdAt,
    );
  }

  await removeFilesIfExist(
    [
      existing?.file_path ?? null,
      existing?.original_file_path ?? null,
      existing?.preview_file_path ?? null,
    ].filter(
      (value): value is string =>
        Boolean(
          value &&
            value !== mainUri &&
            value !== originalUri &&
            value !== previewUri,
        ),
    ),
  );

  return true;
}

async function markAssetForResync(assetIdValue: string) {
  const assetId = parsePositiveIntegerId(assetIdValue, 'Asset');
  const db = await getDb();
  const existing = await db.getFirstAsync<{
    id: number;
    metadata: string | null;
  }>(
    `
      SELECT
        id,
        metadata
      FROM assets
      WHERE id = ?
    `,
    assetId,
  );

  if (!existing?.id) {
    return false;
  }

  const nextUpdatedAt = new Date().toISOString();
  const currentMetadata =
    existing.metadata && existing.metadata.trim().length > 0
      ? parseAssetMetadata(existing.metadata)
      : {};

  await db.runAsync(
    `
      UPDATE assets
      SET metadata = ?
      WHERE id = ?
    `,
    JSON.stringify({
      ...currentMetadata,
      updatedAt: nextUpdatedAt,
    }),
    assetId,
  );

  return true;
}

async function applyRemoteDocument(
  remoteDocument: WorkspaceSyncPushDocumentPayload,
  transferMap: DownloadedTransferMap,
) {
  const documentId = parsePositiveIntegerId(remoteDocument.id, 'Belge');
  const existing = await getExistingDocumentRecord(documentId);
  const existingPages = await getExistingDocumentPages(documentId);
  const existingPageUriById = new Map<string, string | null>(
    existingPages.map((page) => [String(page.id), page.image_path]),
  );
  const pageRows = remoteDocument.pages.map((page) => {
    const pageId = parsePositiveIntegerId(page.id, 'Belge sayfası');
    const imageUri =
      pickTransferredUri(transferMap, 'document_page', page.id, ['image', 'file']) ??
      existingPageUriById.get(page.id) ??
      null;

    return {
      pageId,
      pageOrder: page.pageOrder,
      width: page.width,
      height: page.height,
      createdAt: page.createdAt,
      imageUri,
    };
  });

  if (pageRows.some((page) => !page.imageUri)) {
    return false;
  }

  const thumbnailUri =
    pickTransferredUri(transferMap, 'document_thumbnail', remoteDocument.id, [
      'thumbnail',
      'thumb',
      'file',
    ]) ??
    existing?.thumbnail_path ??
    pageRows[0]?.imageUri ??
    null;
  const pdfUri =
    pickTransferredUri(transferMap, 'document_pdf', remoteDocument.id, ['pdf', 'file']) ??
    existing?.pdf_path ??
    null;
  const db = await getDb();

  if (existing?.id) {
    await db.runAsync(
      `
        UPDATE documents
        SET
          title = ?,
          status = ?,
          pdf_path = ?,
          thumbnail_path = ?,
          ocr_text = ?,
          ocr_status = ?,
          ocr_updated_at = ?,
          ocr_error = NULL,
          word_path = NULL,
          word_updated_at = NULL,
          is_favorite = ?,
          updated_at = ?
        WHERE id = ?
      `,
      remoteDocument.title,
      remoteDocument.status,
      pdfUri,
      thumbnailUri,
      remoteDocument.ocrText,
      remoteDocument.ocrStatus,
      remoteDocument.ocrText ? remoteDocument.updatedAt : null,
      existing.is_favorite,
      remoteDocument.updatedAt,
      documentId,
    );
  } else {
    await db.runAsync(
      `
        INSERT INTO documents (
          id,
          title,
          status,
          pdf_path,
          thumbnail_path,
          ocr_text,
          ocr_status,
          ocr_updated_at,
          ocr_error,
          word_path,
          word_updated_at,
          is_favorite,
          collection_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, NULL, ?, ?)
      `,
      documentId,
      remoteDocument.title,
      remoteDocument.status,
      pdfUri,
      thumbnailUri,
      remoteDocument.ocrText,
      remoteDocument.ocrStatus,
      remoteDocument.ocrText ? remoteDocument.updatedAt : null,
      remoteDocument.createdAt,
      remoteDocument.updatedAt,
    );
  }

  await db.runAsync(
    `
      DELETE FROM overlay_items
      WHERE document_id = ?
    `,
    documentId,
  );
  await db.runAsync(
    `
      DELETE FROM document_pages
      WHERE document_id = ?
    `,
    documentId,
  );

  for (const page of pageRows) {
    await db.runAsync(
      `
        INSERT INTO document_pages (
          id,
          document_id,
          image_path,
          page_order,
          width,
          height,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      page.pageId,
      documentId,
      page.imageUri,
      page.pageOrder,
      page.width,
      page.height,
      page.createdAt,
    );
  }

  for (const overlay of remoteDocument.overlays) {
    const overlayId = parsePositiveIntegerId(overlay.id, 'Overlay');
    const pageId = overlay.pageId ? parsePositiveIntegerId(overlay.pageId, 'Overlay sayfası') : null;

    await db.runAsync(
      `
        INSERT INTO overlay_items (
          id,
          document_id,
          page_id,
          type,
          x,
          y,
          width,
          height,
          rotation,
          opacity,
          content,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      overlayId,
      documentId,
      pageId,
      overlay.type,
      overlay.x,
      overlay.y,
      overlay.width,
      overlay.height,
      overlay.rotation,
      overlay.opacity,
      serializeOverlayContent(overlay.content),
      overlay.createdAt,
    );
  }

  await syncDocumentTaxonomy(documentId, {
    collectionName: remoteDocument.collectionName,
    tagNames: remoteDocument.tagNames,
    updatedAt: remoteDocument.updatedAt,
  });

  await removeFilesIfExist(
    [
      existing?.pdf_path ?? null,
      existing?.thumbnail_path ?? null,
      existing?.word_path ?? null,
      ...existingPages.map((page) => page.image_path),
    ].filter(
      (value): value is string =>
        Boolean(
          value &&
            value !== pdfUri &&
            value !== thumbnailUri &&
            !pageRows.some((page) => page.imageUri === value),
        ),
    ),
  );

  return true;
}

async function markDocumentForResync(documentIdValue: string) {
  const documentId = parsePositiveIntegerId(documentIdValue, 'Belge');
  const db = await getDb();
  const existing = await getExistingDocumentRecord(documentId);

  if (!existing?.id) {
    return false;
  }

  await db.runAsync(
    `
      UPDATE documents
      SET updated_at = ?
      WHERE id = ?
    `,
    new Date().toISOString(),
    documentId,
  );

  return true;
}

async function deleteRemoteDocument(documentIdValue: string) {
  const documentId = parsePositiveIntegerId(documentIdValue, 'Belge');
  const existing = await getExistingDocumentRecord(documentId);
  const existingPages = await getExistingDocumentPages(documentId);

  if (!existing?.id) {
    return false;
  }

  const db = await getDb();

  await db.runAsync(
    `
      DELETE FROM documents
      WHERE id = ?
    `,
    documentId,
  );

  await removeFilesIfExist([
    existing.pdf_path,
    existing.thumbnail_path,
    existing.word_path,
    ...existingPages.map((page) => page.image_path),
  ]);

  return true;
}

async function deleteRemoteAsset(assetIdValue: string) {
  const assetId = parsePositiveIntegerId(assetIdValue, 'Asset');
  const usageCount = await getAssetUsageCount(assetId);

  if (usageCount > 0) {
    return false;
  }

  const existing = await getExistingAssetRecord(assetId);

  if (!existing?.id) {
    return false;
  }

  const db = await getDb();

  await db.runAsync(
    `
      DELETE FROM assets
      WHERE id = ?
    `,
    assetId,
  );

  await removeFilesIfExist([
    existing.file_path,
    existing.original_file_path,
    existing.preview_file_path,
  ]);

  return true;
}

function buildApplySummary(parts: {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  downloaded: number;
  retainedLocal: number;
  conflicts: number;
}) {
  const labels = [
    parts.created > 0 ? `${parts.created} oluşturuldu` : null,
    parts.updated > 0 ? `${parts.updated} güncellendi` : null,
    parts.deleted > 0 ? `${parts.deleted} silindi` : null,
    parts.downloaded > 0 ? `${parts.downloaded} dosya indirildi` : null,
    parts.retainedLocal > 0 ? `${parts.retainedLocal} kayıt yerelde tutuldu` : null,
    parts.skipped > 0 ? `${parts.skipped} kayıt atlandı` : null,
    parts.conflicts > 0 ? `${parts.conflicts} çatışma bırakıldı` : null,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(', ') : 'Uygulanacak uzak değişiklik bulunamadı.';
}

export async function runWorkspaceSyncPullPreview(
  session: AuthSession | null,
): Promise<WorkspaceSyncPullPreview> {
  const plan = await buildPullPlan(session);

  return {
    summary: plan.summary,
    snapshot: plan.snapshot,
    decisionCounts: plan.decisionCounts,
    remoteCounts: {
      documents: plan.remoteResult.documents.length,
      assets: plan.remoteResult.assets.length,
      tombstones: plan.remoteResult.tombstones.length,
      fileTransfers: plan.remoteResult.fileTransfers.length,
      workspaceProfile: plan.remoteResult.workspaceProfile ? 1 : 0,
    },
    pendingTransferCount: plan.pendingTransferCount,
    conflicts: plan.conflicts,
  };
}

export async function applyWorkspaceSyncPull(
  session: AuthSession | null,
  conflictResolutions: WorkspaceSyncPullConflictResolutionMap = {},
): Promise<WorkspaceSyncPullApplyResult> {
  if (!session?.accessToken) {
    throw new Error('Pull uygulamak için oturum gerekli.');
  }

  const plan = await buildPullPlan(session, conflictResolutions);

  if (plan.conflicts.length > 0) {
    throw new Error(`${plan.conflicts.length} çatışma çözülmeden pull uygulanamaz.`);
  }

  const { transferMap, downloadedCount } = await downloadApplicableTransfers(
    session,
    plan,
  );
  const appliedCounts = {
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    downloaded: downloadedCount,
    retainedLocal: 0,
  };

  if (
    plan.workspaceProfileAction &&
    (plan.workspaceProfileAction === 'create' || plan.workspaceProfileAction === 'update') &&
    plan.remoteResult.workspaceProfile
  ) {
    await applyWorkspaceProfile(plan.remoteResult.workspaceProfile);
    if (plan.workspaceProfileAction === 'create') {
      appliedCounts.created += 1;
    } else {
      appliedCounts.updated += 1;
    }
  }

  for (const remoteAsset of plan.remoteResult.assets) {
    const action = plan.assetActions.get(remoteAsset.id);

    if (action !== 'create' && action !== 'update') {
      if (
        action === 'skip' &&
        getConflictResolution(conflictResolutions, 'asset', remoteAsset.id) === 'keep_local'
      ) {
        const marked = await markAssetForResync(remoteAsset.id);
        if (marked) {
          appliedCounts.retainedLocal += 1;
        } else {
          appliedCounts.skipped += 1;
        }
        continue;
      }

      if (action === 'skip' || action === 'conflict') {
        appliedCounts.skipped += 1;
      }
      continue;
    }

    const applied = await applyRemoteAsset(remoteAsset, transferMap);

    if (!applied) {
      appliedCounts.skipped += 1;
      continue;
    }

    if (action === 'create') {
      appliedCounts.created += 1;
    } else {
      appliedCounts.updated += 1;
    }
  }

  for (const remoteDocument of plan.remoteResult.documents) {
    const action = plan.documentActions.get(remoteDocument.id);

    if (action !== 'create' && action !== 'update') {
      if (
        action === 'skip' &&
        getConflictResolution(conflictResolutions, 'document', remoteDocument.id) === 'keep_local'
      ) {
        const marked = await markDocumentForResync(remoteDocument.id);
        if (marked) {
          appliedCounts.retainedLocal += 1;
        } else {
          appliedCounts.skipped += 1;
        }
        continue;
      }

      if (action === 'skip' || action === 'conflict') {
        appliedCounts.skipped += 1;
      }
      continue;
    }

    const applied = await applyRemoteDocument(remoteDocument, transferMap);

    if (!applied) {
      appliedCounts.skipped += 1;
      continue;
    }

    if (action === 'create') {
      appliedCounts.created += 1;
    } else {
      appliedCounts.updated += 1;
    }
  }

  for (const tombstoneAction of plan.tombstoneActions) {
    if (tombstoneAction.action !== 'delete') {
      if (
        tombstoneAction.action === 'skip' &&
        getConflictResolution(
          conflictResolutions,
          tombstoneAction.entityType,
          tombstoneAction.entityId,
        ) === 'keep_local'
      ) {
        const marked =
          tombstoneAction.entityType === 'document'
            ? await markDocumentForResync(tombstoneAction.entityId)
            : await markAssetForResync(tombstoneAction.entityId);
        if (marked) {
          appliedCounts.retainedLocal += 1;
        } else {
          appliedCounts.skipped += 1;
        }
        continue;
      }

      if (tombstoneAction.action === 'skip' || tombstoneAction.action === 'conflict') {
        appliedCounts.skipped += 1;
      }
      continue;
    }

    const deleted =
      tombstoneAction.entityType === 'document'
        ? await deleteRemoteDocument(tombstoneAction.entityId)
        : await deleteRemoteAsset(tombstoneAction.entityId);

    if (deleted) {
      appliedCounts.deleted += 1;
    } else {
      appliedCounts.skipped += 1;
    }
  }

  if (
    plan.workspaceProfileAction === 'skip' &&
    getConflictResolution(conflictResolutions, 'workspace_profile', 'active') === 'keep_local'
  ) {
    const marked = await markWorkspaceProfileForResync();
    if (marked) {
      appliedCounts.retainedLocal += 1;
    } else {
      appliedCounts.skipped += 1;
    }
  }

  const summary = buildApplySummary({
    ...appliedCounts,
    conflicts: plan.conflicts.length,
  });
  const snapshot = await recordWorkspaceSyncPushResult(
    session,
    {
      status: plan.conflicts.length > 0 ? 'blocked' : 'ready',
      summary,
      lastSuccessfulSyncAt: plan.remoteResult.lastSuccessfulSyncAt,
      membershipStatus: plan.remoteResult.membershipStatus,
    },
    {
      advanceCursor: true,
    },
  );
  const pendingTransferCount = await countPendingWorkspaceSyncTransfers(
    plan.activeWorkspace.id,
  );

  return {
    applied:
      appliedCounts.created + appliedCounts.updated + appliedCounts.deleted > 0,
    summary,
    snapshot,
    appliedCounts,
    conflictCount: plan.conflicts.length,
    pendingTransferCount,
  };
}

export const workspaceSyncPullService = {
  runWorkspaceSyncPullPreview,
  applyWorkspaceSyncPull,
};
