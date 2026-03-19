// src/screens/billing/PricingScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import { useBillingStore } from '../../store/useBillingStore';
import { Radius, Spacing, Typography, colors } from '../../theme';

type PaidPlan = 'monthly' | 'yearly' | 'lifetime';

type CompareRow = {
  label: string;
  freeValue: string;
  premiumValue: string;
};

const COMPARE_ROWS: CompareRow[] = [
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
  },
  {
    label: "Word'e çevirip kaydetme",
    freeValue: 'Yok',
    premiumValue: 'Var',
  },
  {
    label: "Excel'e çevirip kaydetme",
    freeValue: 'Yok',
    premiumValue: 'Var',
  },
  {
    label: 'PDF paylaşma',
    freeValue: 'Yok',
    premiumValue: 'Var',
  },
  {
    label: 'Tam sayfa reklamlar',
    freeValue: 'Var',
    premiumValue: 'Yok',
  },
];

function formatPlanLabel(plan: string) {
  switch (plan) {
    case 'monthly':
      return 'Aylık';
    case 'yearly':
      return 'Yıllık';
    case 'lifetime':
      return 'Ömür boyu';
    default:
      return 'Free';
  }
}

function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) {
    return 'Yok';
  }

  const date = new Date(expiresAt);

  if (Number.isNaN(date.getTime())) {
    return 'Geçersiz';
  }

  return date.toLocaleString('tr-TR');
}

function PlanCard({
  title,
  subtitle,
  price,
  active,
  disabled,
  badge,
  onPress,
}: {
  title: string;
  subtitle: string;
  price: string;
  badge?: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.planCard,
        active && styles.planCardActive,
        disabled && styles.planCardDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.planHeaderRow}>
        <View style={styles.planTextBlock}>
          <Text style={styles.planTitle}>{title}</Text>
          <Text style={styles.planSubtitle}>{subtitle}</Text>
        </View>

        <View style={styles.planBadgeColumn}>
          {badge ? <Text style={styles.planBadge}>{badge}</Text> : null}
          {active ? <Text style={styles.activeChip}>Aktif</Text> : null}
        </View>
      </View>

      <Text style={styles.planPrice}>{price}</Text>
    </Pressable>
  );
}

function CompareValue({
  value,
  highlight,
}: {
  value: string;
  highlight?: boolean;
}) {
  return (
    <Text style={[styles.compareValue, highlight && styles.compareValueHighlight]}>
      {value}
    </Text>
  );
}

export function PricingScreen() {
  const hydrated = useBillingStore((state) => state.hydrated);
  const isPro = useBillingStore((state) => state.isPro);
  const plan = useBillingStore((state) => state.plan);
  const expiresAt = useBillingStore((state) => state.expiresAt);
  const activateMockPlan = useBillingStore((state) => state.activateMockPlan);
  const restoreMockPurchase = useBillingStore((state) => state.restoreMockPurchase);
  const resetToFree = useBillingStore((state) => state.resetToFree);

  const [busyAction, setBusyAction] = useState<PaidPlan | 'restore' | 'reset' | null>(null);

  const planSummary = useMemo(
    () => ({
      premiumLabel: isPro ? 'Açık' : 'Kapalı',
      planLabel: formatPlanLabel(plan),
      expiryLabel: formatExpiry(expiresAt),
    }),
    [expiresAt, isPro, plan],
  );

  const isBusy = busyAction !== null;

  const handleChoosePlan = async (nextPlan: PaidPlan) => {
    try {
      setBusyAction(nextPlan);
      await activateMockPlan(nextPlan);

      Alert.alert(
        'Premium aktif',
        `Mock premium plan aktif edildi: ${formatPlanLabel(nextPlan)}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Plan aktivasyonu sırasında bir hata oluştu.';

      Alert.alert('Hata', message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestore = async () => {
    try {
      setBusyAction('restore');
      await restoreMockPurchase();
      Alert.alert('Tamamlandı', 'Mock satın alım durumu geri yüklendi.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Satın alım geri yüklenemedi.';

      Alert.alert('Hata', message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleReset = async () => {
    try {
      setBusyAction('reset');
      await resetToFree();
      Alert.alert('Tamamlandı', 'Hesap free plana döndürüldü.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Free plana dönüş sırasında hata oluştu.';

      Alert.alert('Hata', message);
    } finally {
      setBusyAction(null);
    }
  };

  if (!hydrated) {
    return (
      <Screen title="Premium" subtitle="Premium durumu hazırlanıyor...">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Premium durumu yükleniyor...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Premium"
      subtitle="Free sürümle tüm araçları dene, premium ile kaydet ve reklamsız devam et."
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>PDF Kaşe Premium</Text>
          <Text style={styles.heroTitle}>Kaydetme ve paylaşma kilidini aç</Text>
          <Text style={styles.heroText}>
            Free kullanıcı tüm araçları kullanabilir. Premium ile PDF / Word / Excel
            kaydetme, paylaşma ve reklamsız kullanım açılır.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Mevcut durum</Text>
          <Text style={styles.statusLine}>Premium: {planSummary.premiumLabel}</Text>
          <Text style={styles.statusLine}>Plan: {planSummary.planLabel}</Text>
          <Text style={styles.statusLine}>Bitiş: {planSummary.expiryLabel}</Text>
        </View>

        <View style={styles.compareCard}>
          <Text style={styles.sectionTitle}>Free ve Premium farkı</Text>

          <View style={styles.compareHeaderRow}>
            <Text style={[styles.compareHeaderCell, styles.compareFeatureCell]}>Özellik</Text>
            <Text style={styles.compareHeaderCell}>Free</Text>
            <Text style={styles.compareHeaderCell}>Premium</Text>
          </View>

          {COMPARE_ROWS.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.compareRow,
                index > 0 && styles.compareRowBorder,
              ]}
            >
              <Text style={[styles.compareLabel, styles.compareFeatureCell]}>
                {row.label}
              </Text>
              <CompareValue value={row.freeValue} />
              <CompareValue value={row.premiumValue} highlight />
            </View>
          ))}
        </View>

        <View style={styles.planList}>
          <PlanCard
            title="Aylık"
            subtitle="Hızlı başlamak isteyenler için reklamsız ve sınırsız kayıt."
            price="₺99 / ay"
            badge="En hızlı"
            active={plan === 'monthly'}
            disabled={isBusy || plan === 'monthly'}
            onPress={() => handleChoosePlan('monthly')}
          />

          <PlanCard
            title="Yıllık"
            subtitle="Daha düşük maliyetle tam premium kullanım."
            price="₺699 / yıl"
            badge="En avantajlı"
            active={plan === 'yearly'}
            disabled={isBusy || plan === 'yearly'}
            onPress={() => handleChoosePlan('yearly')}
          />

          <PlanCard
            title="Ömür boyu"
            subtitle="Tek ödeme ile kalıcı premium erişim."
            price="₺1499 tek sefer"
            badge="Kalıcı"
            active={plan === 'lifetime'}
            disabled={isBusy || plan === 'lifetime'}
            onPress={() => handleChoosePlan('lifetime')}
          />
        </View>

        <View style={styles.actionGroup}>
          <Pressable
            disabled={isBusy}
            onPress={handleRestore}
            style={({ pressed }) => [
              styles.secondaryAction,
              isBusy && styles.actionDisabled,
              pressed && !isBusy && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>
              Mock satın alımı geri yükle
            </Text>
          </Pressable>

          <Pressable
            disabled={isBusy || !isPro}
            onPress={handleReset}
            style={({ pressed }) => [
              styles.dangerAction,
              (isBusy || !isPro) && styles.actionDisabled,
              pressed && !isBusy && isPro && styles.pressed,
            ]}
          >
            <Text style={styles.dangerActionText}>Free plana dön</Text>
          </Pressable>
        </View>

        {isBusy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.busyText}>İşlem uygulanıyor...</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  heroEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  heroTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  heroText: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.titleSmall,
    color: colors.text,
    marginBottom: Spacing.sm,
  },
  statusLine: {
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  compareCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
  compareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
  },
  compareHeaderCell: {
    flex: 1,
    ...Typography.caption,
    color: colors.textTertiary,
    fontWeight: '800',
    textAlign: 'center',
  },
  compareFeatureCell: {
    flex: 2.2,
    textAlign: 'left',
    paddingRight: Spacing.sm,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  compareRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  compareLabel: {
    flex: 2.2,
    ...Typography.bodySmall,
    color: colors.text,
    paddingRight: Spacing.sm,
  },
  compareValue: {
    flex: 1,
    ...Typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '700',
  },
  compareValueHighlight: {
    color: colors.primary,
  },
  planList: {
    gap: Spacing.md,
  },
  planCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  planCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  planCardDisabled: {
    opacity: 0.65,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  planTextBlock: {
    flex: 1,
    gap: 6,
  },
  planTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  planSubtitle: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  planBadgeColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  planBadge: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  activeChip: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  planPrice: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  actionGroup: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  secondaryAction: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: 14,
  },
  secondaryActionText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
  },
  dangerAction: {
    backgroundColor: '#1F1720',
    borderColor: '#4B2632',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: 14,
  },
  dangerActionText: {
    color: '#FCA5A5',
    textAlign: 'center',
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.65,
  },
  busyRow: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  busyText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.92,
  },
});