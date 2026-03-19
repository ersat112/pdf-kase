import type { BillingPlan, BillingState } from './billing.service';

export type PremiumCapabilityKey =
  | 'save'
  | 'share'
  | 'remove_ads'
  | 'export_pdf'
  | 'export_word'
  | 'export_excel';

export type BillingCapabilities = {
  canUseTool: boolean;
  canSave: boolean;
  canShare: boolean;
  canRemoveAds: boolean;
  canExportPdf: boolean;
  canExportWord: boolean;
  canExportExcel: boolean;
};

export type BillingCompareRow = {
  label: string;
  freeValue: string;
  premiumValue: string;
  capability?: PremiumCapabilityKey;
};

const PREMIUM_FEATURE_LABELS: Record<PremiumCapabilityKey, string> = {
  save: 'Kaydetme',
  share: 'Paylaşma',
  remove_ads: 'Reklamsız kullanım',
  export_pdf: 'PDF kaydetme',
  export_word: "Word'e çevirme",
  export_excel: "Excel'e çevirme",
};

export const BILLING_COMPARE_ROWS: BillingCompareRow[] = [
  {
    label: 'Tarama ve OCR',
    freeValue: 'Var',
    premiumValue: 'Var',
  },
  {
    label: 'Akıllı sil / kırp / düzenleme',
    freeValue: 'Var',
    premiumValue: 'Var',
  },
  {
    label: 'Kaşe / imza deneme',
    freeValue: 'Var',
    premiumValue: 'Var',
  },
  {
    label: 'PDF kaydetme',
    freeValue: 'Yok',
    premiumValue: 'Var',
    capability: 'export_pdf',
  },
  {
    label: "Word'e çevirip kaydetme",
    freeValue: 'Yok',
    premiumValue: 'Var',
    capability: 'export_word',
  },
  {
    label: "Excel'e çevirip kaydetme",
    freeValue: 'Yok',
    premiumValue: 'Var',
    capability: 'export_excel',
  },
  {
    label: 'PDF paylaşma',
    freeValue: 'Yok',
    premiumValue: 'Var',
    capability: 'share',
  },
  {
    label: 'Tam sayfa reklamlar',
    freeValue: 'Var',
    premiumValue: 'Yok',
    capability: 'remove_ads',
  },
];

export function getBillingPlanLabel(plan: BillingPlan) {
  switch (plan) {
    case 'monthly':
      return 'Aylık';
    case 'yearly':
      return 'Yıllık';
    case 'lifetime':
      return 'Ömür boyu';
    case 'free':
    default:
      return 'Free';
  }
}

export function resolveBillingCapabilities(
  state?: Partial<BillingState> | null,
): BillingCapabilities {
  const isPremium = Boolean(state?.isPro);

  return {
    canUseTool: true,
    canSave: isPremium,
    canShare: isPremium,
    canRemoveAds: isPremium,
    canExportPdf: isPremium,
    canExportWord: isPremium,
    canExportExcel: isPremium,
  };
}

export function getPremiumGateFeatureLabel(capability: PremiumCapabilityKey) {
  return PREMIUM_FEATURE_LABELS[capability];
}

export function getPremiumGateMessage(capability: PremiumCapabilityKey) {
  const featureLabel = getPremiumGateFeatureLabel(capability);

  return `${featureLabel} özelliği premium plana dahildir. Free sürümde tüm araçları deneyebilir, premium ile kaydetme, paylaşma, dışa aktarma ve reklamsız kullanımı açabilirsin.`;
}