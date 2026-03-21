// src/store/useBillingStore.ts
import { create } from 'zustand';

import type {
  BillingPlan,
  BillingState,
} from '../modules/billing/billing.service';
import {
  clearStoredBillingState,
  defaultBillingState,
  getStoredBillingState,
  normalizeBillingState,
  setStoredBillingState,
} from '../modules/billing/billing.service';

type BillingStore = BillingState & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  activateMockPlan: (plan: BillingPlan) => Promise<void>;
  restoreMockPurchase: () => Promise<void>;
  resetToFree: () => Promise<void>;
};

let hydrationPromise: Promise<void> | null = null;

function createExpiry(plan: BillingPlan): string | null {
  if (plan === 'monthly') {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString();
  }

  if (plan === 'yearly') {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString();
  }

  return null;
}

function resolveBillingState(input: BillingState): BillingState {
  return normalizeBillingState(input);
}

async function persistResolvedBillingState(state: BillingState): Promise<void> {
  if (state.plan === 'free' || !state.isPro) {
    await clearStoredBillingState();
    return;
  }

  await setStoredBillingState(state);
}

async function syncStoredBillingState() {
  const stored = await getStoredBillingState();
  const resolved = resolveBillingState(stored);

  await persistResolvedBillingState(resolved);

  return resolved;
}

export const useBillingStore = create<BillingStore>()((set, get) => ({
  ...defaultBillingState,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) {
      return;
    }

    if (hydrationPromise) {
      return hydrationPromise;
    }

    hydrationPromise = (async () => {
      try {
        const resolved = await syncStoredBillingState();

        set({
          ...resolved,
          hydrated: true,
        });
      } catch (error) {
        console.warn('[BillingStore] Hydration failed:', error);

        set({
          ...defaultBillingState,
          hydrated: true,
        });
      }
    })().finally(() => {
      hydrationPromise = null;
    });

    return hydrationPromise;
  },

  activateMockPlan: async (plan) => {
    const nextState = resolveBillingState({
      isPro: plan !== 'free',
      plan,
      expiresAt: createExpiry(plan),
      metadata:
        plan === 'free'
          ? defaultBillingState.metadata
          : {
              mode: 'mock',
              updatedAt: new Date().toISOString(),
              version: 'v1',
            },
    });

    await persistResolvedBillingState(nextState);

    set({
      ...nextState,
      hydrated: true,
    });
  },

  restoreMockPurchase: async () => {
    try {
      const resolved = await syncStoredBillingState();

      set({
        ...resolved,
        hydrated: true,
      });
    } catch (error) {
      console.warn('[BillingStore] Restore failed:', error);

      set({
        ...defaultBillingState,
        hydrated: true,
      });
    }
  },

  resetToFree: async () => {
    await clearStoredBillingState();

    set({
      ...defaultBillingState,
      hydrated: true,
    });
  },
}));
