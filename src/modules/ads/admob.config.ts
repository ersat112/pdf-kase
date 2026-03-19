// src/modules/ads/admob.config.ts
import { Platform } from 'react-native';
import { TestIds, type RequestOptions } from 'react-native-google-mobile-ads';

const IOS_BANNER_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID?.trim();
const ANDROID_BANNER_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID?.trim();

const IOS_INTERSTITIAL_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID?.trim();
const ANDROID_INTERSTITIAL_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID?.trim();

function sanitizeUnitId(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
}

function resolvePlatformUnitId(params: {
  ios?: string;
  android?: string;
}): string | undefined {
  return Platform.select<string | undefined>({
    ios: sanitizeUnitId(params.ios),
    android: sanitizeUnitId(params.android),
    default: undefined,
  });
}

function resolveUnitId(testId: string, params: { ios?: string; android?: string }): string | null {
  if (__DEV__) {
    return testId;
  }

  return resolvePlatformUnitId(params) ?? null;
}

export const ADMOB_UNIT_IDS = {
  banner: resolveUnitId(TestIds.BANNER, {
    ios: IOS_BANNER_UNIT_ID,
    android: ANDROID_BANNER_UNIT_ID,
  }),
  interstitial: resolveUnitId(TestIds.INTERSTITIAL, {
    ios: IOS_INTERSTITIAL_UNIT_ID,
    android: ANDROID_INTERSTITIAL_UNIT_ID,
  }),
} as const;

export const ADMOB_REQUEST_OPTIONS: RequestOptions = Object.freeze({
  requestNonPersonalizedAdsOnly: true,
  keywords: ['pdf', 'scanner', 'document', 'office'],
});

export function isAdMobBannerEnabled(): boolean {
  return Boolean(ADMOB_UNIT_IDS.banner);
}

export function isAdMobInterstitialEnabled(): boolean {
  return Boolean(ADMOB_UNIT_IDS.interstitial);
}

export function isAdMobRuntimeEnabled(): boolean {
  return isAdMobBannerEnabled() || isAdMobInterstitialEnabled();
}