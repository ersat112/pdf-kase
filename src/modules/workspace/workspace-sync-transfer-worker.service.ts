import { getAuthActiveWorkspace } from '../auth/auth.service';
import type { AuthSession } from '../auth/auth.types';
import {
  downloadAssetFile,
  downloadPdfFile,
  downloadScanFile,
  downloadThumbnailFile,
  fileExists,
} from '../storage/file.service';
import {
  clearWorkspaceSyncTransferTasks,
  getWorkspaceSyncTransferQueueSummary,
  listWorkspaceSyncTransferTasks,
  resetWorkspaceSyncTransferTasks,
  updateWorkspaceSyncTransferTaskStatus,
  type WorkspaceSyncTransferQueueSummary,
  type WorkspaceSyncTransferTask,
} from './workspace-sync-transfer-queue.service';

const TRANSFER_DOWNLOAD_HEADERS_ACCEPT = {
  Accept: '*/*',
} as const;

export type WorkspaceSyncTransferQueueRunResult = {
  processedCount: number;
  downloadedCount: number;
  failedCount: number;
  skippedCount: number;
  summary: WorkspaceSyncTransferQueueSummary;
};

function requireActiveWorkspace(session: AuthSession | null) {
  const activeWorkspace = getAuthActiveWorkspace(session);

  if (!session?.accessToken || !activeWorkspace) {
    throw new Error('Transfer kuyruğunu işlemek için aktif oturum ve çalışma alanı gerekli.');
  }

  return activeWorkspace;
}

function buildDownloadHeaders(accessToken: string) {
  return {
    ...TRANSFER_DOWNLOAD_HEADERS_ACCEPT,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function downloadTransferTask(
  task: WorkspaceSyncTransferTask,
  headers: Record<string, string>,
) {
  switch (task.entityType) {
    case 'asset':
      return downloadAssetFile(task.downloadUrl, task.fileName, headers);
    case 'document_page':
      return downloadScanFile(task.downloadUrl, task.fileName, headers);
    case 'document_thumbnail':
      return downloadThumbnailFile(task.downloadUrl, task.fileName, headers);
    case 'document_pdf':
      return downloadPdfFile(task.downloadUrl, task.fileName, headers);
    default:
      return null;
  }
}

function normalizeLimit(limit?: number | null) {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return null;
  }

  return Math.trunc(limit);
}

async function recoverWorkspaceSyncTransferQueueState(workspaceId: string) {
  await resetWorkspaceSyncTransferTasks(workspaceId, ['running']);
  const tasks = await listWorkspaceSyncTransferTasks(workspaceId);

  for (const task of tasks) {
    if (task.status !== 'completed') {
      continue;
    }

    if (task.localUri && (await fileExists(task.localUri))) {
      continue;
    }

    await updateWorkspaceSyncTransferTaskStatus({
      id: task.id,
      status: 'pending',
      completedAt: null,
      localUri: null,
      lastError: 'Yerel dosya bulunamadı, tekrar indirme bekliyor.',
    });
  }
}

export async function getWorkspaceSyncTransferQueueSnapshot(
  session: AuthSession | null,
): Promise<WorkspaceSyncTransferQueueSummary | null> {
  const activeWorkspace = getAuthActiveWorkspace(session);

  if (!activeWorkspace) {
    return null;
  }

  await recoverWorkspaceSyncTransferQueueState(activeWorkspace.id);
  return getWorkspaceSyncTransferQueueSummary(activeWorkspace.id);
}

export async function runWorkspaceSyncTransferQueue(
  session: AuthSession | null,
  options?: {
    includeFailed?: boolean;
    limit?: number | null;
  },
): Promise<WorkspaceSyncTransferQueueRunResult> {
  const activeWorkspace = requireActiveWorkspace(session);
  const accessToken = session?.accessToken;

  if (!accessToken) {
    throw new Error('Transfer kuyruğunu işlemek için erişim anahtarı gerekli.');
  }

  await recoverWorkspaceSyncTransferQueueState(activeWorkspace.id);

  const headers = buildDownloadHeaders(accessToken);
  const allTasks = await listWorkspaceSyncTransferTasks(activeWorkspace.id);
  const allowedStatuses = new Set<WorkspaceSyncTransferTask['status']>(
    options?.includeFailed ? ['pending', 'failed'] : ['pending'],
  );
  const limit = normalizeLimit(options?.limit);
  const tasks = allTasks
    .filter((task) => allowedStatuses.has(task.status))
    .sort((left, right) => left.enqueuedAt.localeCompare(right.enqueuedAt))
    .slice(0, limit ?? undefined);

  let processedCount = 0;
  let downloadedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    if (task.localUri && (await fileExists(task.localUri))) {
      processedCount += 1;
      skippedCount += 1;
      await updateWorkspaceSyncTransferTaskStatus({
        id: task.id,
        status: 'completed',
        completedAt: task.completedAt ?? new Date().toISOString(),
        lastError: null,
      });
      continue;
    }

    const startedAt = new Date().toISOString();
    await updateWorkspaceSyncTransferTaskStatus({
      id: task.id,
      status: 'running',
      attemptCount: task.attemptCount + 1,
      lastAttemptAt: startedAt,
      completedAt: null,
      lastError: null,
    });

    processedCount += 1;

    try {
      const downloaded = await downloadTransferTask(task, headers);

      if (!downloaded?.uri) {
        failedCount += 1;
        await updateWorkspaceSyncTransferTaskStatus({
          id: task.id,
          status: 'failed',
          completedAt: new Date().toISOString(),
          lastError: 'Dosya indirilemedi.',
        });
        continue;
      }

      downloadedCount += 1;
      await updateWorkspaceSyncTransferTaskStatus({
        id: task.id,
        status: 'completed',
        localUri: downloaded.uri,
        completedAt: new Date().toISOString(),
        lastError: null,
      });
    } catch (error) {
      failedCount += 1;
      await updateWorkspaceSyncTransferTaskStatus({
        id: task.id,
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
    processedCount,
    downloadedCount,
    failedCount,
    skippedCount,
    summary: await getWorkspaceSyncTransferQueueSummary(activeWorkspace.id),
  };
}

export async function retryWorkspaceSyncFailedTransfers(
  session: AuthSession | null,
  options?: {
    limit?: number | null;
  },
) {
  const activeWorkspace = requireActiveWorkspace(session);
  await resetWorkspaceSyncTransferTasks(activeWorkspace.id, ['failed', 'running']);

  return runWorkspaceSyncTransferQueue(session, {
    includeFailed: false,
    limit: options?.limit,
  });
}

export async function clearWorkspaceSyncCompletedTransfers(
  session: AuthSession | null,
) {
  const activeWorkspace = requireActiveWorkspace(session);
  await clearWorkspaceSyncTransferTasks(activeWorkspace.id, ['completed']);
  return getWorkspaceSyncTransferQueueSummary(activeWorkspace.id);
}

export const workspaceSyncTransferWorkerService = {
  getWorkspaceSyncTransferQueueSnapshot,
  runWorkspaceSyncTransferQueue,
  retryWorkspaceSyncFailedTransfers,
  clearWorkspaceSyncCompletedTransfers,
};
