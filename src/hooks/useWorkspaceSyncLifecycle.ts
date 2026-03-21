import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  getWorkspaceSyncSnapshot,
} from '../modules/workspace/workspace-sync.service';
import {
  getWorkspaceSyncTransferQueueSnapshot,
  runWorkspaceSyncTransferQueue,
} from '../modules/workspace/workspace-sync-transfer-worker.service';
import {
  captureObservabilityError,
  trackObservabilityEvent,
} from '../modules/observability/observability.service';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkspaceSyncStore } from '../store/useWorkspaceSyncStore';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

export function useWorkspaceSyncLifecycle() {
  const authStatus = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lifecycleRunKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const runLifecycleRefresh = useCallback(async () => {
    if (inFlightRef.current || authStatus === 'booting') {
      return;
    }

    inFlightRef.current = true;

    try {
      const [snapshot, transferQueueSummary] = await Promise.all([
        getWorkspaceSyncSnapshot(session),
        getWorkspaceSyncTransferQueueSnapshot(session),
      ]);

      useWorkspaceSyncStore.setState((state) => ({
        ...state,
        hydrated: true,
        snapshot,
        transferQueueSummary,
        error: null,
      }));

      const shouldAutoResumeTransfers =
        authStatus === 'authenticated' &&
        snapshot.canUseRemoteSync &&
        transferQueueSummary &&
        transferQueueSummary.pendingCount + transferQueueSummary.runningCount > 0;

      void trackObservabilityEvent({
        feature: 'sync_lifecycle',
        name: shouldAutoResumeTransfers ? 'auto_resume_ready' : 'lifecycle_refresh_completed',
        source: 'workspace_sync_lifecycle',
        metadata: {
          canUseRemoteSync: snapshot.canUseRemoteSync,
          pendingTransfers: transferQueueSummary?.pendingCount ?? 0,
          runningTransfers: transferQueueSummary?.runningCount ?? 0,
        },
      });

      if (!shouldAutoResumeTransfers) {
        return;
      }

      const result = await runWorkspaceSyncTransferQueue(session, {
        includeFailed: false,
      });

      useWorkspaceSyncStore.setState((state) => ({
        ...state,
        transferQueueSummary: result.summary,
      }));
      void trackObservabilityEvent({
        feature: 'sync_lifecycle',
        name: 'auto_resume_completed',
        source: 'workspace_sync_lifecycle',
        metadata: {
          processed: result.processedCount,
          downloaded: result.downloadedCount,
          failed: result.failedCount,
        },
      });
    } catch (error) {
      console.warn('[WorkspaceSyncLifecycle] Auto-resume failed:', error);
      void captureObservabilityError({
        feature: 'sync_lifecycle',
        name: 'auto_resume_failed',
        source: 'workspace_sync_lifecycle',
        error,
      });

      useWorkspaceSyncStore.setState((state) => ({
        ...state,
        error: getErrorMessage(
          error,
          'Transfer kuyruğu otomatik sürdürülürken beklenmeyen bir hata oluştu.',
        ),
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, [authStatus, session]);

  useEffect(() => {
    if (authStatus === 'booting') {
      return;
    }

    const nextKey = [
      authStatus,
      session?.activeWorkspaceId ?? 'workspace:none',
      session?.metadata?.updatedAt ?? 'session:none',
    ].join(':');

    if (lifecycleRunKeyRef.current === nextKey) {
      return;
    }

    lifecycleRunKeyRef.current = nextKey;
    void runLifecycleRefresh();
  }, [
    authStatus,
    runLifecycleRefresh,
    session?.activeWorkspaceId,
    session?.metadata?.updatedAt,
  ]);

  useEffect(() => {
    if (authStatus === 'booting') {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState.match(/inactive|background/) && nextState === 'active') {
        void runLifecycleRefresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [authStatus, runLifecycleRefresh]);
}
