// src/modules/ads/admob.service.ts
import mobileAds, {
  AdEventType,
  InterstitialAd,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

import {
  ADMOB_REQUEST_OPTIONS,
  ADMOB_UNIT_IDS,
  isAdMobInterstitialEnabled,
  isAdMobRuntimeEnabled,
} from './admob.config';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

class AdMobService {
  private initialized = false;
  private initializingPromise: Promise<void> | null = null;

  private interstitial: InterstitialAd | null = null;
  private interstitialLoaded = false;
  private interstitialLoading = false;
  private interstitialShowing = false;
  private interstitialUnsubscribers: Array<() => void> = [];

  async initialize(): Promise<void> {
    if (!isAdMobRuntimeEnabled()) {
      return;
    }

    if (this.initialized) {
      return;
    }

    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.PG,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
      });

      await mobileAds().initialize();
      this.initialized = true;
    })().finally(() => {
      this.initializingPromise = null;
    });

    return this.initializingPromise;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isInterstitialReady(): boolean {
    return isAdMobInterstitialEnabled() && this.interstitialLoaded && !this.interstitialShowing;
  }

  preloadInterstitial(force = false): void {
    if (!isAdMobInterstitialEnabled()) {
      return;
    }

    void this.initialize()
      .then(() => {
        if (!this.interstitial) {
          this.buildInterstitial();
        }

        if (!this.interstitial) {
          return;
        }

        if (this.interstitialLoading) {
          return;
        }

        if (this.interstitialLoaded && !force) {
          return;
        }

        this.interstitialLoading = true;
        this.interstitial.load();
      })
      .catch((error) => {
        console.warn('[AdMob] Interstitial preload failed:', error);
      });
  }

  async waitUntilInterstitialReady(timeoutMs = 10_000): Promise<boolean> {
    if (!isAdMobInterstitialEnabled()) {
      return false;
    }

    await this.initialize();
    this.preloadInterstitial();

    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (this.isInterstitialReady()) {
        return true;
      }

      await sleep(250);
    }

    return this.isInterstitialReady();
  }

  async showInterstitial(): Promise<boolean> {
    if (!isAdMobInterstitialEnabled()) {
      return false;
    }

    await this.initialize();

    if (!this.interstitial || !this.interstitialLoaded || this.interstitialShowing) {
      this.preloadInterstitial();
      return false;
    }

    try {
      await this.interstitial.show();
      return true;
    } catch (error) {
      console.warn('[AdMob] Interstitial show failed:', error);
      this.interstitialShowing = false;
      this.interstitialLoaded = false;
      this.interstitialLoading = false;
      this.rebuildInterstitial();
      return false;
    }
  }

  async showInterstitialWhenReady(options?: {
    timeoutMs?: number;
  }): Promise<boolean> {
    const isReady = await this.waitUntilInterstitialReady(options?.timeoutMs ?? 10_000);

    if (!isReady) {
      this.preloadInterstitial(true);
      return false;
    }

    return this.showInterstitial();
  }

  private buildInterstitial(): void {
    const unitId = ADMOB_UNIT_IDS.interstitial;

    if (!unitId) {
      return;
    }

    this.cleanupInterstitial();

    const instance = InterstitialAd.createForAdRequest(
      unitId,
      ADMOB_REQUEST_OPTIONS,
    );

    this.interstitial = instance;

    this.interstitialUnsubscribers.push(
      instance.addAdEventListener(AdEventType.LOADED, () => {
        this.interstitialLoaded = true;
        this.interstitialLoading = false;
      }),
    );

    this.interstitialUnsubscribers.push(
      instance.addAdEventListener(AdEventType.OPENED, () => {
        this.interstitialLoaded = false;
        this.interstitialLoading = false;
        this.interstitialShowing = true;
      }),
    );

    this.interstitialUnsubscribers.push(
      instance.addAdEventListener(AdEventType.CLOSED, () => {
        this.interstitialLoaded = false;
        this.interstitialLoading = false;
        this.interstitialShowing = false;
        this.preloadInterstitial();
      }),
    );

    this.interstitialUnsubscribers.push(
      instance.addAdEventListener(AdEventType.ERROR, (error) => {
        console.warn('[AdMob] Interstitial error:', error);
        this.interstitialLoaded = false;
        this.interstitialLoading = false;
        this.interstitialShowing = false;
        this.rebuildInterstitial();
      }),
    );
  }

  private rebuildInterstitial(): void {
    this.cleanupInterstitial();
    this.buildInterstitial();
    this.preloadInterstitial(true);
  }

  private cleanupInterstitial(): void {
    this.interstitialUnsubscribers.forEach((unsubscribe) => {
      unsubscribe();
    });

    this.interstitialUnsubscribers = [];
    this.interstitial = null;
    this.interstitialLoaded = false;
    this.interstitialLoading = false;
    this.interstitialShowing = false;
  }
}

export const admobService = new AdMobService();

export async function initializeMobileAds(): Promise<void> {
  await admobService.initialize();
}

export function primeInterstitialAd(): void {
  admobService.preloadInterstitial();
}

export async function showInterstitialIfReady(options?: {
  enabled?: boolean;
}): Promise<boolean> {
  if (options?.enabled === false) {
    return false;
  }

  return admobService.showInterstitial();
}

export async function showInterstitialAd(enabled = true): Promise<boolean> {
  if (!enabled) {
    return false;
  }

  return admobService.showInterstitial();
}