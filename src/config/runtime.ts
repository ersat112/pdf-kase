export type AppRuntimeStage = 'preview' | 'production';

export type AuthRuntimeProvider =
  | 'preview_local'
  | 'firebase_auth'
  | 'supabase_auth'
  | 'custom';

export type BillingRuntimeProvider =
  | 'preview_local'
  | 'revenuecat'
  | 'store_native'
  | 'custom';

export type AnalyticsRuntimeProvider =
  | 'preview_local'
  | 'firebase_analytics'
  | 'custom'
  | 'none';

export type CrashRuntimeProvider =
  | 'preview_local'
  | 'sentry'
  | 'custom'
  | 'none';

type AppRuntimeConfig = {
  stage: AppRuntimeStage;
  requireAuthentication: boolean;
  authProvider: AuthRuntimeProvider;
  billingProvider: BillingRuntimeProvider;
  observabilityEnabled: boolean;
  analyticsProvider: AnalyticsRuntimeProvider;
  crashProvider: CrashRuntimeProvider;
};

function normalizeEnumValue<TValue extends string>(
  value: string | undefined,
  allowed: readonly TValue[],
  fallback: TValue,
): TValue {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase() as TValue;
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeBooleanValue(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

const stage = normalizeEnumValue<AppRuntimeStage>(
  process.env.EXPO_PUBLIC_APP_STAGE,
  ['preview', 'production'] as const,
  'preview',
);

const authProvider = normalizeEnumValue<AuthRuntimeProvider>(
  process.env.EXPO_PUBLIC_AUTH_PROVIDER,
  ['preview_local', 'firebase_auth', 'supabase_auth', 'custom'] as const,
  'preview_local',
);

const billingProvider = normalizeEnumValue<BillingRuntimeProvider>(
  process.env.EXPO_PUBLIC_BILLING_PROVIDER,
  ['preview_local', 'revenuecat', 'store_native', 'custom'] as const,
  'preview_local',
);

const observabilityEnabled = normalizeBooleanValue(
  process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED,
  true,
);

const analyticsProvider = normalizeEnumValue<AnalyticsRuntimeProvider>(
  process.env.EXPO_PUBLIC_ANALYTICS_PROVIDER,
  ['preview_local', 'firebase_analytics', 'custom', 'none'] as const,
  observabilityEnabled ? 'preview_local' : 'none',
);

const crashProvider = normalizeEnumValue<CrashRuntimeProvider>(
  process.env.EXPO_PUBLIC_CRASH_PROVIDER,
  ['preview_local', 'sentry', 'custom', 'none'] as const,
  observabilityEnabled ? 'preview_local' : 'none',
);

export const appRuntime = Object.freeze<AppRuntimeConfig>({
  stage,
  requireAuthentication: normalizeBooleanValue(
    process.env.EXPO_PUBLIC_REQUIRE_AUTH,
    true,
  ),
  authProvider,
  billingProvider,
  observabilityEnabled,
  analyticsProvider,
  crashProvider,
});

export function isPreviewRuntime() {
  return appRuntime.stage === 'preview';
}

export function getAuthRuntimeDisplayLabel() {
  switch (appRuntime.authProvider) {
    case 'firebase_auth':
      return 'Firebase Auth';
    case 'supabase_auth':
      return 'Supabase Auth';
    case 'custom':
      return 'Özel auth katmanı';
    case 'preview_local':
    default:
      return 'Önizleme oturumu';
  }
}

export function getBillingRuntimeDisplayLabel() {
  switch (appRuntime.billingProvider) {
    case 'revenuecat':
      return 'RevenueCat premium';
    case 'store_native':
      return 'Native mağaza premium';
    case 'custom':
      return 'Özel premium katmanı';
    case 'preview_local':
    default:
      return 'Önizleme premium katmanı';
  }
}

export function getAnalyticsRuntimeDisplayLabel() {
  switch (appRuntime.analyticsProvider) {
    case 'firebase_analytics':
      return 'Firebase Analytics';
    case 'custom':
      return 'Özel analytics katmanı';
    case 'none':
      return 'Analytics kapalı';
    case 'preview_local':
    default:
      return 'Yerel analytics günlüğü';
  }
}

export function getCrashRuntimeDisplayLabel() {
  switch (appRuntime.crashProvider) {
    case 'sentry':
      return 'Sentry crash raporu';
    case 'custom':
      return 'Özel crash katmanı';
    case 'none':
      return 'Crash raporu kapalı';
    case 'preview_local':
    default:
      return 'Yerel hata günlüğü';
  }
}
