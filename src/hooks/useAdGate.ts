// src/hooks/useAdGate.ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isAdMobRuntimeEnabled } from '../modules/ads/admob.config';
import { admobService } from '../modules/ads/admob.service';
import { useBillingStore } from '../store/useBillingStore';

type UseAdGateOptions = {
  enableLifecycleAds?: boolean;
};

const MIN_INTERSTITIAL_GAP_MS = 75_000;
const SESSION_INTERSTITIAL_INTERVAL_MS = 180_000;

let launchInterstitialShown = false;
let lastInterstitialShownAt = 0;

function canPassThrottle(bypassThrottle?: boolean) {
  if (bypassThrottle) {
    return true;
  }

  return Date.now() - lastInterstitialShownAt >= MIN_INTERSTITIAL_GAP_MS;
}

export function useAdGate(options?: UseAdGateOptions) {
  const enableLifecycleAds = options?.enableLifecycleAds === true;

  const isPro = useBillingStore((state) => state.isPro);
  const hydrated = useBillingStore((state) => state.hydrated);

  const canShowAds = useMemo(
    () => hydrated && !isPro && isAdMobRuntimeEnabled(),
    [hydrated, isPro],
  );

  const lifecycleBootstrappedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!canShowAds) {
      return;
    }

    void admobService
      .initialize()
      .then(() => {
        admobService.preloadInterstitial();
      })
      .catch((error) => {
        console.warn('[AdMob] Initialization failed:', error);
      });
  }, [canShowAds]);

  const preloadInterstitial = useCallback(() => {
    if (!canShowAds) {
      return;
    }

    admobService.preloadInterstitial();
  }, [canShowAds]);

  const showInterstitial = useCallback(
    async (options?: { bypassThrottle?: boolean }): Promise<boolean> => {
      if (!canShowAds) {
        return false;
      }

      if (!canPassThrottle(options?.bypassThrottle)) {
        admobService.preloadInterstitial();
        return false;
      }

      const shown = await admobService.showInterstitial();

      if (shown) {
        lastInterstitialShownAt = Date.now();
      }

      return shown;
    },
    [canShowAds],
  );

  const showInterstitialWhenReady = useCallback(
    async (options?: {
      timeoutMs?: number;
      bypassThrottle?: boolean;
    }): Promise<boolean> => {
      if (!canShowAds) {
        return false;
      }

      if (!canPassThrottle(options?.bypassThrottle)) {
        admobService.preloadInterstitial();
        return false;
      }

      const shown = await admobService.showInterstitialWhenReady({
        timeoutMs: options?.timeoutMs,
      });

      if (shown) {
        lastInterstitialShownAt = Date.now();
      }

      return shown;
    },
    [canShowAds],
  );

  const runAfterTask = useCallback(
    async <T>(task: () => Promise<T> | T): Promise<T> => {
      const result = await Promise.resolve(task());
      await showInterstitial();
      return result;
    },
    [showInterstitial],
  );

  useEffect(() => {
    if (!enableLifecycleAds || !canShowAds) {
      return;
    }

    let active = true;

    const bootstrapLifecycleAds = async () => {
      if (lifecycleBootstrappedRef.current) {
        return;
      }

      lifecycleBootstrappedRef.current = true;

      try {
        await admobService.initialize();
        admobService.preloadInterstitial();

        if (!launchInterstitialShown) {
          const shown = await showInterstitialWhenReady({
            timeoutMs: 10_000,
            bypassThrottle: true,
          });

          if (shown && active) {
            launchInterstitialShown = true;
          }
        }
      } catch (error) {
        console.warn('[AdMob] Lifecycle bootstrap failed:', error);
      }
    };

    void bootstrapLifecycleAds();

    const intervalId = setInterval(() => {
      if (appStateRef.current !== 'active') {
        return;
      }

      void showInterstitial();
    }, SESSION_INTERSTITIAL_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState.match(/inactive|background/) &&
        nextState === 'active' &&
        canShowAds
      ) {
        admobService.preloadInterstitial();
        void showInterstitial();
      }
    });

    return () => {
      active = false;
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [canShowAds, enableLifecycleAds, showInterstitial, showInterstitialWhenReady]);

  return {
    canShowAds,
    interstitialsEnabled: canShowAds,
    preloadInterstitial,
    showInterstitial,
    showInterstitialWhenReady,
    runAfterTask,
  };
}