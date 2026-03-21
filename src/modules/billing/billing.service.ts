import * as SecureStore from 'expo-secure-store';

import { getBillingRuntimeDisplayLabel } from '../../config/runtime';

export type BillingPlan = 'free' | 'monthly' | 'yearly' | 'lifetime';

export type BillingMetadata = {
  mode: 'mock' | 'none';
  updatedAt: string | null;
  version: 'v1';
};

export type BillingState = {
  isPro: boolean;
  plan: BillingPlan;
  expiresAt: string | null;
  metadata?: BillingMetadata | null;
};

const BILLING_STATE_KEY = 'pdf-kase.billing.state.v1';

const VALID_PLANS: BillingPlan[] = ['free', 'monthly', 'yearly', 'lifetime'];

export const defaultBillingState: BillingState = {
  isPro: false,
  plan: 'free',
  expiresAt: null,
  metadata: {
    mode: 'none',
    updatedAt: null,
    version: 'v1',
  },
};

function isValidPlan(plan: unknown): plan is BillingPlan {
  return typeof plan === 'string' && VALID_PLANS.includes(plan as BillingPlan);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeExpiresAt(expiresAt: unknown) {
  if (typeof expiresAt !== 'string') {
    return null;
  }

  const trimmed = expiresAt.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function normalizeMetadata(
  value: unknown,
  fallbackMode: BillingMetadata['mode'],
): BillingMetadata {
  if (!isObjectRecord(value)) {
    return {
      mode: fallbackMode,
      updatedAt: null,
      version: 'v1',
    };
  }

  const mode =
    value.mode === 'mock' || value.mode === 'none' ? value.mode : fallbackMode;

  const updatedAt =
    typeof value.updatedAt === 'string' && value.updatedAt.trim().length > 0
      ? value.updatedAt
      : null;

  return {
    mode,
    updatedAt,
    version: 'v1',
  };
}

export function isBillingExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const time = Date.parse(expiresAt);

  if (Number.isNaN(time)) {
    return true;
  }

  return time <= Date.now();
}

function getNormalizedPremiumState(
  plan: Exclude<BillingPlan, 'free'>,
  expiresAt: string | null,
  metadata: BillingMetadata,
): BillingState {
  if (plan === 'lifetime') {
    return {
      isPro: true,
      plan,
      expiresAt: null,
      metadata,
    };
  }

  if (!expiresAt || isBillingExpired(expiresAt)) {
    return defaultBillingState;
  }

  return {
    isPro: true,
    plan,
    expiresAt,
    metadata,
  };
}

async function persistNormalizedBillingState(
  normalized: BillingState,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      BILLING_STATE_KEY,
      JSON.stringify(normalized),
    );
  } catch (error) {
    console.warn('[BillingService] Write failed:', error);
    throw new Error('Premium durumu kaydedilemedi.');
  }
}

export function normalizeBillingState(
  input?: Partial<BillingState> | null,
): BillingState {
  if (!input || !isValidPlan(input.plan)) {
    return defaultBillingState;
  }

  const plan = input.plan;
  const expiresAt = normalizeExpiresAt(input.expiresAt);

  if (plan === 'free') {
    return defaultBillingState;
  }

  const metadata = normalizeMetadata(input.metadata, 'mock');

  return getNormalizedPremiumState(plan, expiresAt, metadata);
}

export function createBillingState(
  plan: BillingPlan,
  expiresAt?: string | null,
): BillingState {
  return normalizeBillingState({
    plan,
    expiresAt: expiresAt ?? null,
  });
}

export function isPremiumActive(state: BillingState | null | undefined) {
  if (!state) {
    return false;
  }

  const normalized = normalizeBillingState(state);
  return normalized.isPro;
}

export function isMockBillingState(state: BillingState | null | undefined) {
  if (!state) {
    return false;
  }

  const normalized = normalizeBillingState(state);
  return normalized.isPro && normalized.metadata?.mode === 'mock';
}

export function getBillingRuntimeLabel(state: BillingState | null | undefined) {
  return isMockBillingState(state)
    ? 'Önizleme premium katmanı'
    : getBillingRuntimeDisplayLabel();
}

export async function getStoredBillingState(): Promise<BillingState> {
  try {
    const raw = await SecureStore.getItemAsync(BILLING_STATE_KEY);

    if (!raw) {
      return defaultBillingState;
    }

    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeBillingState(
      isObjectRecord(parsed) ? (parsed as Partial<BillingState>) : null,
    );

    if (JSON.stringify(normalized) !== raw) {
      await persistNormalizedBillingState(normalized);
    }

    return normalized;
  } catch (error) {
    console.warn('[BillingService] Read failed:', error);
    return defaultBillingState;
  }
}

export async function setStoredBillingState(state: BillingState): Promise<void> {
  const normalized = normalizeBillingState(state);
  await persistNormalizedBillingState(normalized);
}

export async function setStoredBillingPlan(
  plan: BillingPlan,
  expiresAt?: string | null,
): Promise<BillingState> {
  const normalized = createBillingState(plan, expiresAt ?? null);
  await persistNormalizedBillingState(normalized);
  return normalized;
}

export async function clearStoredBillingState(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BILLING_STATE_KEY);
  } catch (error) {
    console.warn('[BillingService] Clear failed:', error);
    throw new Error('Premium durumu temizlenemedi.');
  }
}
