import { create } from 'zustand';

import type { AuthSession } from '../modules/auth/auth.service';
import {
  checkWorkspaceSyncReadiness,
  getWorkspaceSyncSnapshot,
  type WorkspaceSyncSnapshot,
} from '../modules/workspace/workspace-sync.service';
import {
  runWorkspaceSyncPush,
  type WorkspaceSyncPushRunResult,
} from '../modules/workspace/workspace-sync-push.service';
import {
  applyWorkspaceSyncPull,
  buildWorkspaceSyncPullConflictId,
  type WorkspaceSyncPullConflictItem,
  runWorkspaceSyncPullPreview,
  type WorkspaceSyncPullApplyResult,
  type WorkspaceSyncPullConflictResolution,
  type WorkspaceSyncPullPreview,
} from '../modules/workspace/workspace-sync-pull.service';
import {
  clearWorkspaceSyncCompletedTransfers,
  getWorkspaceSyncTransferQueueSnapshot,
  retryWorkspaceSyncFailedTransfers,
  runWorkspaceSyncTransferQueue,
  type WorkspaceSyncTransferQueueRunResult,
} from '../modules/workspace/workspace-sync-transfer-worker.service';
import type { WorkspaceSyncTransferQueueSummary } from '../modules/workspace/workspace-sync-transfer-queue.service';
import {
  captureObservabilityError,
  trackObservabilityEvent,
} from '../modules/observability/observability.service';

type WorkspaceSyncStore = {
  hydrated: boolean;
  busy: boolean;
  snapshot: WorkspaceSyncSnapshot | null;
  pullPreview: WorkspaceSyncPullPreview | null;
  pullConflictResolutions: Record<string, WorkspaceSyncPullConflictResolution>;
  transferQueueSummary: WorkspaceSyncTransferQueueSummary | null;
  error: string | null;
  hydrate: (session: AuthSession | null) => Promise<void>;
  refresh: (session: AuthSession | null) => Promise<WorkspaceSyncSnapshot | null>;
  checkReadiness: (session: AuthSession | null) => Promise<WorkspaceSyncSnapshot | null>;
  pushToRemote: (session: AuthSession | null) => Promise<WorkspaceSyncPushRunResult>;
  previewPull: (session: AuthSession | null) => Promise<WorkspaceSyncPullPreview>;
  applyPull: (session: AuthSession | null) => Promise<WorkspaceSyncPullApplyResult>;
  refreshTransferQueue: (
    session: AuthSession | null,
  ) => Promise<WorkspaceSyncTransferQueueSummary | null>;
  processTransferQueue: (
    session: AuthSession | null,
  ) => Promise<WorkspaceSyncTransferQueueRunResult>;
  retryFailedTransfers: (
    session: AuthSession | null,
  ) => Promise<WorkspaceSyncTransferQueueRunResult>;
  clearCompletedTransfers: (
    session: AuthSession | null,
  ) => Promise<WorkspaceSyncTransferQueueSummary | null>;
  setPullConflictResolution: (
    conflict: Pick<WorkspaceSyncPullConflictItem, 'entityType' | 'entityId'>,
    resolution: WorkspaceSyncPullConflictResolution,
  ) => void;
  setAllPullConflictResolutions: (
    conflicts: WorkspaceSyncPullConflictItem[],
    resolution: WorkspaceSyncPullConflictResolution,
  ) => void;
  clearPullConflictResolutions: () => void;
  clearPullPreview: () => void;
  clearError: () => void;
};

let hydrationPromise: Promise<void> | null = null;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

export const useWorkspaceSyncStore = create<WorkspaceSyncStore>()((set, get) => ({
  hydrated: false,
  busy: false,
  snapshot: null,
  pullPreview: null,
  pullConflictResolutions: {},
  transferQueueSummary: null,
  error: null,

  hydrate: async (session) => {
    if (get().hydrated) {
      return;
    }

    if (hydrationPromise) {
      return hydrationPromise;
    }

    hydrationPromise = (async () => {
      try {
        const [snapshot, transferQueueSummary] = await Promise.all([
          getWorkspaceSyncSnapshot(session),
          getWorkspaceSyncTransferQueueSnapshot(session),
        ]);

        set({
          hydrated: true,
          snapshot,
          pullPreview: null,
          pullConflictResolutions: {},
          transferQueueSummary,
          error: null,
        });
        void trackObservabilityEvent({
          feature: 'sync',
          name: 'sync_store_hydrated',
          source: 'workspace_sync_store',
          metadata: {
            mode: snapshot.mode,
            canUseRemoteSync: snapshot.canUseRemoteSync,
            pendingTransfers: transferQueueSummary?.pendingCount ?? 0,
          },
        });
      } catch (error) {
        console.warn('[WorkspaceSyncStore] Hydration failed:', error);
        void captureObservabilityError({
          feature: 'sync',
          name: 'sync_store_hydration_failed',
          source: 'workspace_sync_store',
          error,
        });

        set({
          hydrated: true,
          snapshot: null,
          error: getErrorMessage(
            error,
            'Sync özeti hazırlanırken beklenmeyen bir hata oluştu.',
          ),
        });
      }
    })().finally(() => {
      hydrationPromise = null;
    });

    return hydrationPromise;
  },

  refresh: async (session) => {
    try {
      set({ busy: true, error: null });
      const [snapshot, transferQueueSummary] = await Promise.all([
        getWorkspaceSyncSnapshot(session),
        getWorkspaceSyncTransferQueueSnapshot(session),
      ]);

        set({
          hydrated: true,
          busy: false,
          snapshot,
          transferQueueSummary,
          error: null,
      });
      void trackObservabilityEvent({
        feature: 'sync',
        name: 'sync_summary_refreshed',
        source: 'workspace_sync_store',
        metadata: {
          mode: snapshot.mode,
          pendingChanges: snapshot.hasPendingLocalChanges,
          pendingTransfers: transferQueueSummary?.pendingCount ?? 0,
        },
      });

      return snapshot;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Sync özeti yenilenirken beklenmeyen bir hata oluştu.',
      );

      set({
        hydrated: true,
        busy: false,
        error: message,
      });

      void captureObservabilityError({
        feature: 'sync',
        name: 'sync_summary_refresh_failed',
        source: 'workspace_sync_store',
        error,
      });
      throw new Error(message);
    }
  },

  checkReadiness: async (session) => {
    try {
      set({ busy: true, error: null });
      const [snapshot, transferQueueSummary] = await Promise.all([
        checkWorkspaceSyncReadiness(session),
        getWorkspaceSyncTransferQueueSnapshot(session),
      ]);

        set({
          hydrated: true,
          busy: false,
          snapshot,
          transferQueueSummary,
          error: null,
      });
      void trackObservabilityEvent({
        feature: 'sync',
        name: 'sync_readiness_checked',
        source: 'workspace_sync_store',
        metadata: {
          mode: snapshot.mode,
          canUseRemoteSync: snapshot.canUseRemoteSync,
          membershipStatus: snapshot.membershipStatus,
        },
      });

      return snapshot;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Bulut hazırlığı kontrol edilirken beklenmeyen bir hata oluştu.',
      );

      set({
        hydrated: true,
        busy: false,
        error: message,
      });

      void captureObservabilityError({
        feature: 'sync',
        name: 'sync_readiness_check_failed',
        source: 'workspace_sync_store',
        error,
      });
      throw new Error(message);
    }
  },

  pushToRemote: async (session) => {
    try {
      set({ busy: true, error: null });
      const result = await runWorkspaceSyncPush(session);
      const transferQueueSummary = await getWorkspaceSyncTransferQueueSnapshot(session);

        set({
          hydrated: true,
          busy: false,
          snapshot: result.snapshot,
          transferQueueSummary,
          error: null,
        });
      void trackObservabilityEvent({
        feature: 'sync',
        name: result.pushed ? 'delta_push_succeeded' : 'delta_push_noop',
        source: 'workspace_sync_store',
        metadata: {
          documents: result.payloadCounts.documents,
          assets: result.payloadCounts.assets,
          tombstones: result.payloadCounts.tombstones,
        },
      });

      return result;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Delta push sırasında beklenmeyen bir hata oluştu.',
      );

      set({
        hydrated: true,
        busy: false,
        error: message,
      });

      void captureObservabilityError({
        feature: 'sync',
        name: 'delta_push_failed',
        source: 'workspace_sync_store',
        error,
      });
      throw new Error(message);
    }
  },

  previewPull: async (session) => {
    try {
      set({ busy: true, error: null });
      const preview = await runWorkspaceSyncPullPreview(session);
      const transferQueueSummary = await getWorkspaceSyncTransferQueueSnapshot(session);

      set({
        hydrated: true,
          busy: false,
          snapshot: preview.snapshot,
          pullPreview: preview,
          pullConflictResolutions: {},
          transferQueueSummary,
          error: null,
      });
      void trackObservabilityEvent({
        feature: 'sync',
        name: 'pull_preview_ready',
        source: 'workspace_sync_store',
        metadata: {
          creates: preview.decisionCounts.create,
          updates: preview.decisionCounts.update,
          deletes: preview.decisionCounts.delete,
          conflicts: preview.decisionCounts.conflict,
          pendingTransfers: preview.pendingTransferCount,
        },
      });

      return preview;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Pull önizleme hazırlanırken beklenmeyen bir hata oluştu.',
      );

      set({
        hydrated: true,
        busy: false,
        error: message,
      });

      void captureObservabilityError({
        feature: 'sync',
        name: 'pull_preview_failed',
        source: 'workspace_sync_store',
        error,
      });
      throw new Error(message);
    }
  },

  applyPull: async (session) => {
      try {
        set({ busy: true, error: null });
      const result = await applyWorkspaceSyncPull(session, get().pullConflictResolutions);
      const transferQueueSummary = await getWorkspaceSyncTransferQueueSnapshot(session);

      set({
        hydrated: true,
        busy: false,
        snapshot: result.snapshot,
        pullPreview: null,
        pullConflictResolutions: {},
        transferQueueSummary,
        error: null,
      });
      void trackObservabilityEvent({
        feature: 'sync',
        name: result.applied ? 'pull_apply_succeeded' : 'pull_apply_noop',
        source: 'workspace_sync_store',
        metadata: {
          created: result.appliedCounts.created,
          updated: result.appliedCounts.updated,
          deleted: result.appliedCounts.deleted,
          retainedLocal: result.appliedCounts.retainedLocal,
          skipped: result.appliedCounts.skipped,
          conflicts: result.conflictCount,
          pendingTransfers: result.pendingTransferCount,
        },
      });

      return result;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Pull uygulanırken beklenmeyen bir hata oluştu.',
      );

      set({
        hydrated: true,
        busy: false,
        error: message,
      });

      void captureObservabilityError({
        feature: 'sync',
        name: 'pull_apply_failed',
        source: 'workspace_sync_store',
        error,
      });
      throw new Error(message);
    }
  },

  refreshTransferQueue: async (session) => {
    try {
      set({ busy: true, error: null });
      const transferQueueSummary = await getWorkspaceSyncTransferQueueSnapshot(session);

      set({
        hydrated: true,
        busy: false,
        transferQueueSummary,
        error: null,
      });
      void trackObservabilityEvent({
        feature: 'sync',
        name: 'transfer_queue_refreshed',
        source: 'workspace_sync_store',
        metadata: {
          pending: transferQueueSummary?.pendingCount ?? 0,
          running: transferQueueSummary?.runningCount ?? 0,
          failed: transferQueueSummary?.failedCount ?? 0,
        },
      });

      return transferQueueSummary;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Transfer kuyruğu yenilenirken beklenmeyen bir hata oluştu.',
      );

      set({
        hydrated: true,
        busy: false,
        error: message,
      });

      void captureObservabilityError({
        feature: 'sync',
        name: 'transfer_queue_refresh_failed',
        source: 'workspace_sync_store',
        error,
      });
      throw new Error(message);
    }
  },

  processTransferQueue: async (session) => {
    try {
      set({ busy: true, error: null });
      const result = await runWorkspaceSyncTransferQueue(session);

      set({
        hydrated: true,
        busy: false,
        transferQueueSummary: result.summary,
        error: null,
      });
      void trackObservabilityEvent({
        feature: 'sync',
        name: 'transfer_queue_processed',
        source: 'workspace_sync_store',
        metadata: {
          processed: result.processedCount,
          downloaded: result.downloadedCount,
          failed: result.failedCount,
          skipped: result.skippedCount,
        },
      });

      return result;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Transfer kuyruğu işlenirken beklenmeyen bir hata oluştu.',
      );

      set({
        hydrated: true,
        busy: false,
        error: message,
      });

      void captureObservabilityError({
        feature: 'sync',
        name: 'transfer_queue_processing_failed',
        source: 'workspace_sync_store',
        error,
      });
      throw new Error(message);
    }
  },

  retryFailedTransfers: async (session) => {
    try {
      set({ busy: true, error: null });
      const result = await retryWorkspaceSyncFailedTransfers(session);

      set({
        hydrated: true,
        busy: false,
        transferQueueSummary: result.summary,
        error: null,
      });
      void trackObservabilityEvent({
        feature: 'sync',
        name: 'failed_transfers_retried',
        source: 'workspace_sync_store',
        metadata: {
          processed: result.processedCount,
          downloaded: result.downloadedCount,
          failed: result.failedCount,
        },
      });

      return result;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Başarısız transferler yeniden denenirken beklenmeyen bir hata oluştu.',
      );

      set({
        hydrated: true,
        busy: false,
        error: message,
      });

      void captureObservabilityError({
        feature: 'sync',
        name: 'failed_transfers_retry_failed',
        source: 'workspace_sync_store',
        error,
      });
      throw new Error(message);
    }
  },

  clearCompletedTransfers: async (session) => {
    try {
      set({ busy: true, error: null });
      const transferQueueSummary = await clearWorkspaceSyncCompletedTransfers(session);

      set({
        hydrated: true,
        busy: false,
        transferQueueSummary,
        error: null,
      });
      void trackObservabilityEvent({
        feature: 'sync',
        name: 'completed_transfers_cleared',
        source: 'workspace_sync_store',
        metadata: {
          remaining: transferQueueSummary?.totalCount ?? 0,
        },
      });

      return transferQueueSummary;
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Tamamlanan transferler temizlenirken beklenmeyen bir hata oluştu.',
      );

      set({
        hydrated: true,
        busy: false,
        error: message,
      });

      void captureObservabilityError({
        feature: 'sync',
        name: 'completed_transfers_clear_failed',
        source: 'workspace_sync_store',
        error,
      });
      throw new Error(message);
    }
  },

  setPullConflictResolution: (conflict, resolution) => {
    const conflictId = buildWorkspaceSyncPullConflictId(
      conflict.entityType,
      conflict.entityId,
    );

    set((state) => ({
      pullConflictResolutions: {
        ...state.pullConflictResolutions,
        [conflictId]: resolution,
      },
    }));
  },

  setAllPullConflictResolutions: (conflicts, resolution) => {
    if (conflicts.length === 0) {
      return;
    }

    set((state) => {
      const next = { ...state.pullConflictResolutions };

      for (const conflict of conflicts) {
        next[buildWorkspaceSyncPullConflictId(conflict.entityType, conflict.entityId)] =
          resolution;
      }

      return {
        pullConflictResolutions: next,
      };
    });
  },

  clearPullConflictResolutions: () => {
    set({ pullConflictResolutions: {} });
  },

  clearPullPreview: () => {
    set({ pullPreview: null, pullConflictResolutions: {} });
  },

  clearError: () => {
    set({ error: null });
  },
}));
