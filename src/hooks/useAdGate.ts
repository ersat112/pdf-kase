// src/hooks/useAdGate.ts
import { useCallback, useEffect, useMemo } from 'react';

import { isAdMobRuntimeEnabled } from '../modules/ads/admob.config';
import { admobService } from '../modules/ads/admob.service';
import { useBillingStore } from '../store/useBillingStore';

export function useAdGate() {
  const isPro = useBillingStore((state) => state.isPro);
  const hydrated = useBillingStore((state) => state.hydrated);

  const canShowAds = useMemo(
    () => hydrated && !isPro && isAdMobRuntimeEnabled(),
    [hydrated, isPro],
  );

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

  const showInterstitial = useCallback(async (): Promise<boolean> => {
    if (!canShowAds) {
      return false;
    }

    return admobService.showInterstitial();
  }, [canShowAds]);

  const runAfterTask = useCallback(
    async <T>(task: () => Promise<T> | T): Promise<T> => {
      const result = await Promise.resolve(task());
      await showInterstitial();
      return result;
    },
    [showInterstitial],
  );

  return {
    canShowAds,
    interstitialsEnabled: canShowAds,
    preloadInterstitial,
    showInterstitial,
    runAfterTask,
  };
}