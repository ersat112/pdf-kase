import * as SecureStore from 'expo-secure-store';

const WORKSPACE_SYNC_TRANSFER_QUEUE_KEY = 'pdf-kase.workspace-sync.transfer-queue.v1';

export type WorkspaceSyncTransferEntityType =
  | 'asset'
  | 'document_page'
  | 'document_pdf'
  | 'document_thumbnail';

export type WorkspaceSyncTransferTask = {
  id: string;
  workspaceId: string;
  entityType: WorkspaceSyncTransferEntityType;
  entityId: string;
  fileRole: string;
  fileName: string | null;
  downloadUrl: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  enqueuedAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  localUri: string | null;
  completedAt: string | null;
  lastError: string | null;
};

export type WorkspaceSyncTransferQueueSummary = {
  workspaceId: string | null;
  totalCount: number;
  pendingCount: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  resumableCount: number;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  recentTasks: WorkspaceSyncTransferTask[];
};

type PersistedWorkspaceSyncTransferQueue = {
  version: 'v1';
  items: WorkspaceSyncTransferTask[];
};

function createDefaultState(): PersistedWorkspaceSyncTransferQueue {
  return {
    version: 'v1',
    items: [],
  };
}

function normalizeString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function buildWorkspaceSyncTransferTaskId(input: {
  workspaceId: string;
  entityType: WorkspaceSyncTransferEntityType;
  entityId: string;
  fileRole: string;
  downloadUrl: string;
}) {
  return `${input.workspaceId}:${input.entityType}:${input.entityId}:${input.fileRole}:${input.downloadUrl}`;
}

function normalizeTask(value: unknown): WorkspaceSyncTransferTask | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Partial<WorkspaceSyncTransferTask>;
  const workspaceId = normalizeString(item.workspaceId);
  const entityId = normalizeString(item.entityId);
  const fileRole = normalizeString(item.fileRole);
  const downloadUrl = normalizeString(item.downloadUrl);
  const enqueuedAt = normalizeString(item.enqueuedAt);
  const entityType =
    item.entityType === 'asset' ||
    item.entityType === 'document_page' ||
    item.entityType === 'document_pdf' ||
    item.entityType === 'document_thumbnail'
      ? item.entityType
      : null;
  const status =
    item.status === 'completed' ||
    item.status === 'failed' ||
    item.status === 'pending' ||
    item.status === 'running'
      ? item.status
      : 'pending';
  const attemptCount =
    typeof item.attemptCount === 'number' && Number.isFinite(item.attemptCount)
      ? Math.max(0, Math.trunc(item.attemptCount))
      : 0;

  if (!workspaceId || !entityId || !fileRole || !downloadUrl || !enqueuedAt || !entityType) {
    return null;
  }

  return {
    id:
      normalizeString(item.id) ??
      `${workspaceId}:${entityType}:${entityId}:${fileRole}:${downloadUrl}`,
    workspaceId,
    entityType,
    entityId,
    fileRole,
    fileName: normalizeString(item.fileName),
    downloadUrl,
    status,
    enqueuedAt,
    attemptCount,
    lastAttemptAt: normalizeString(item.lastAttemptAt),
    localUri: normalizeString(item.localUri),
    completedAt: normalizeString(item.completedAt),
    lastError: normalizeString(item.lastError),
  };
}

async function readState() {
  try {
    const raw = await SecureStore.getItemAsync(WORKSPACE_SYNC_TRANSFER_QUEUE_KEY);

    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return createDefaultState();
    }

    const items = Array.isArray((parsed as { items?: unknown[] }).items)
      ? ((parsed as { items: unknown[] }).items
          .map((item) => normalizeTask(item))
          .filter(Boolean) as WorkspaceSyncTransferTask[])
      : [];

    return {
      version: 'v1' as const,
      items,
    };
  } catch (error) {
    console.warn('[WorkspaceSyncTransferQueue] Failed to read queue:', error);
    return createDefaultState();
  }
}

async function writeState(state: PersistedWorkspaceSyncTransferQueue) {
  await SecureStore.setItemAsync(
    WORKSPACE_SYNC_TRANSFER_QUEUE_KEY,
    JSON.stringify(state),
  );
}

export async function listWorkspaceSyncTransferTasks(workspaceId?: string | null) {
  const state = await readState();

  if (!workspaceId?.trim()) {
    return [...state.items];
  }

  return state.items.filter((item) => item.workspaceId === workspaceId);
}

export async function upsertWorkspaceSyncTransferTasks(
  tasks: Array<Omit<WorkspaceSyncTransferTask, 'id'>>,
) {
  if (!tasks.length) {
    return [];
  }

  const state = await readState();
  const existing = new Map(state.items.map((item) => [item.id, item]));
  const inserted: WorkspaceSyncTransferTask[] = [];

  for (const task of tasks) {
    const resolvedId = buildWorkspaceSyncTransferTaskId({
      workspaceId: task.workspaceId,
      entityType: task.entityType,
      entityId: task.entityId,
      fileRole: task.fileRole,
      downloadUrl: task.downloadUrl,
    });
    const nextTask: WorkspaceSyncTransferTask = {
      ...task,
      id: resolvedId,
      attemptCount: typeof task.attemptCount === 'number' ? Math.max(0, task.attemptCount) : 0,
      lastAttemptAt: task.lastAttemptAt ?? null,
      localUri: task.localUri ?? null,
      completedAt: task.completedAt ?? null,
      lastError: task.lastError ?? null,
    };
    existing.set(resolvedId, nextTask);
    inserted.push(nextTask);
  }

  state.items = [...existing.values()];
  await writeState(state);

  return inserted;
}

export async function updateWorkspaceSyncTransferTaskStatus(input: {
  id: string;
  status: WorkspaceSyncTransferTask['status'];
  attemptCount?: number;
  lastAttemptAt?: string | null;
  localUri?: string | null;
  completedAt?: string | null;
  lastError?: string | null;
}) {
  const state = await readState();
  let changed = false;

  state.items = state.items.map((item) => {
    if (item.id !== input.id) {
      return item;
    }

    changed = true;

    return {
      ...item,
      status: input.status,
      attemptCount:
        typeof input.attemptCount === 'number' ? Math.max(0, input.attemptCount) : item.attemptCount,
      lastAttemptAt:
        input.lastAttemptAt !== undefined ? input.lastAttemptAt : item.lastAttemptAt,
      localUri:
        input.localUri !== undefined ? input.localUri : item.localUri,
      completedAt:
        input.completedAt !== undefined ? input.completedAt : item.completedAt,
      lastError:
        input.lastError !== undefined ? input.lastError : item.lastError,
    };
  });

  if (changed) {
    await writeState(state);
  }
}

export async function countPendingWorkspaceSyncTransfers(workspaceId?: string | null) {
  const items = await listWorkspaceSyncTransferTasks(workspaceId);
  return items.filter((item) => item.status === 'pending' || item.status === 'running').length;
}

export async function resetWorkspaceSyncTransferTasks(
  workspaceId?: string | null,
  statuses: WorkspaceSyncTransferTask['status'][] = ['failed'],
) {
  const state = await readState();
  let changed = false;
  const allowedStatuses = new Set(statuses);

  state.items = state.items.map((item) => {
    if (
      (workspaceId?.trim() && item.workspaceId !== workspaceId) ||
      !allowedStatuses.has(item.status)
    ) {
      return item;
    }

    changed = true;

    return {
      ...item,
      status: 'pending' as const,
      completedAt: null,
      lastError: null,
    };
  });

  if (changed) {
    await writeState(state);
  }
}

export async function clearWorkspaceSyncTransferTasks(
  workspaceId?: string | null,
  statuses: WorkspaceSyncTransferTask['status'][] = ['completed'],
) {
  const state = await readState();
  const allowedStatuses = new Set(statuses);
  const nextItems = state.items.filter((item) => {
    if (workspaceId?.trim() && item.workspaceId !== workspaceId) {
      return true;
    }

    return !allowedStatuses.has(item.status);
  });

  if (nextItems.length !== state.items.length) {
    state.items = nextItems;
    await writeState(state);
  }
}

function getTaskRecencyValue(task: WorkspaceSyncTransferTask) {
  return (
    task.completedAt ??
    task.lastAttemptAt ??
    task.enqueuedAt
  );
}

export async function getWorkspaceSyncTransferQueueSummary(workspaceId?: string | null) {
  const items = await listWorkspaceSyncTransferTasks(workspaceId);
  const sortedRecentTasks = [...items]
    .sort((left, right) => getTaskRecencyValue(right).localeCompare(getTaskRecencyValue(left)))
    .slice(0, 6);

  const completedTasks = items
    .filter((item) => item.status === 'completed' && item.completedAt)
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''));
  const failedTasks = items
    .filter((item) => item.status === 'failed' && item.completedAt)
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''));

  return {
    workspaceId: workspaceId?.trim() ?? null,
    totalCount: items.length,
    pendingCount: items.filter((item) => item.status === 'pending').length,
    runningCount: items.filter((item) => item.status === 'running').length,
    completedCount: items.filter((item) => item.status === 'completed').length,
    failedCount: items.filter((item) => item.status === 'failed').length,
    resumableCount: items.filter(
      (item) => item.status === 'pending' || item.status === 'running' || item.status === 'failed',
    ).length,
    lastCompletedAt: completedTasks[0]?.completedAt ?? null,
    lastFailedAt: failedTasks[0]?.completedAt ?? null,
    recentTasks: sortedRecentTasks,
  } satisfies WorkspaceSyncTransferQueueSummary;
}

export const workspaceSyncTransferQueueService = {
  listWorkspaceSyncTransferTasks,
  upsertWorkspaceSyncTransferTasks,
  countPendingWorkspaceSyncTransfers,
  updateWorkspaceSyncTransferTaskStatus,
  resetWorkspaceSyncTransferTasks,
  clearWorkspaceSyncTransferTasks,
  getWorkspaceSyncTransferQueueSummary,
};
