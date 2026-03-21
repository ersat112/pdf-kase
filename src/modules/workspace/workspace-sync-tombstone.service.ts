import * as SecureStore from 'expo-secure-store';

const WORKSPACE_SYNC_TOMBSTONES_KEY = 'pdf-kase.workspace-sync.tombstones.v1';

export type WorkspaceSyncTombstoneEntityType = 'asset' | 'document';

export type WorkspaceSyncTombstone = {
  id: string;
  entityType: WorkspaceSyncTombstoneEntityType;
  entityId: string;
  scope: 'workspace' | 'personal';
  entityName: string | null;
  entitySubtype: string | null;
  workspaceName: string | null;
  deletedAt: string;
};

type PersistedWorkspaceSyncTombstones = {
  version: 'v1';
  items: WorkspaceSyncTombstone[];
};

function createDefaultState(): PersistedWorkspaceSyncTombstones {
  return {
    version: 'v1',
    items: [],
  };
}

function normalizeString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeTombstone(value: unknown): WorkspaceSyncTombstone | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Partial<WorkspaceSyncTombstone>;
  const entityType =
    item.entityType === 'asset' || item.entityType === 'document'
      ? item.entityType
      : null;
  const entityId = normalizeString(item.entityId);
  const deletedAt = normalizeString(item.deletedAt);

  if (!entityType || !entityId || !deletedAt) {
    return null;
  }

  return {
    id: normalizeString(item.id) ?? `${entityType}:${entityId}:${deletedAt}`,
    entityType,
    entityId,
    scope: item.scope === 'workspace' ? 'workspace' : 'personal',
    entityName: normalizeString(item.entityName),
    entitySubtype: normalizeString(item.entitySubtype),
    workspaceName: normalizeString(item.workspaceName),
    deletedAt,
  };
}

async function readState() {
  try {
    const raw = await SecureStore.getItemAsync(WORKSPACE_SYNC_TOMBSTONES_KEY);

    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return createDefaultState();
    }

    const items = Array.isArray((parsed as { items?: unknown[] }).items)
      ? ((parsed as { items: unknown[] }).items
          .map((item) => normalizeTombstone(item))
          .filter(Boolean) as WorkspaceSyncTombstone[])
      : [];

    return {
      version: 'v1' as const,
      items,
    };
  } catch (error) {
    console.warn('[WorkspaceSyncTombstoneService] Failed to read tombstones:', error);
    return createDefaultState();
  }
}

async function writeState(state: PersistedWorkspaceSyncTombstones) {
  await SecureStore.setItemAsync(
    WORKSPACE_SYNC_TOMBSTONES_KEY,
    JSON.stringify(state),
  );
}

export async function listWorkspaceSyncTombstones() {
  const state = await readState();
  return [...state.items].sort((left, right) =>
    left.deletedAt.localeCompare(right.deletedAt),
  );
}

export async function enqueueWorkspaceSyncTombstone(
  input: Omit<WorkspaceSyncTombstone, 'id'>,
) {
  const state = await readState();
  const id = `${input.entityType}:${input.entityId}:${input.deletedAt}`;
  const nextItem: WorkspaceSyncTombstone = {
    ...input,
    id,
  };

  state.items = [...state.items.filter((item) => item.id !== id), nextItem];
  await writeState(state);

  return nextItem;
}

export async function acknowledgeWorkspaceSyncTombstones(tombstoneIds: string[]) {
  if (!tombstoneIds.length) {
    return;
  }

  const state = await readState();
  const idSet = new Set(tombstoneIds);
  state.items = state.items.filter((item) => !idSet.has(item.id));
  await writeState(state);
}

export const workspaceSyncTombstoneService = {
  listWorkspaceSyncTombstones,
  enqueueWorkspaceSyncTombstone,
  acknowledgeWorkspaceSyncTombstones,
};
