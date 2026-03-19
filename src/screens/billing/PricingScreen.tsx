// src/screens/billing/PricingScreen.tsx
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import { useBillingStore } from '../../store/useBillingStore';

type PaidPlan = 'monthly' | 'yearly' | 'lifetime';

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
  onPress,
}: {
  title: string;
  subtitle: string;
  price: string;
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
        <Text style={styles.planTitle}>{title}</Text>
        {active ? <Text style={styles.activeChip}>Aktif</Text> : null}
      </View>

      <Text style={styles.planSubtitle}>{subtitle}</Text>
      <Text style={styles.planPrice}>{price}</Text>
    </Pressable>
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
          <ActivityIndicator size="large" color="#35C76F" />
          <Text style={styles.loadingText}>Premium durumu yükleniyor...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Premium"
      subtitle="RevenueCat bağlanmadan önce UI ve entitlement akışını mock planlarla doğrular."
    >
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Mevcut durum</Text>
        <Text style={styles.statusLine}>Premium: {planSummary.premiumLabel}</Text>
        <Text style={styles.statusLine}>Plan: {planSummary.planLabel}</Text>
        <Text style={styles.statusLine}>Bitiş: {planSummary.expiryLabel}</Text>
      </View>

      <View style={styles.benefitCard}>
        <Text style={styles.benefitTitle}>Premium ile açılanlar</Text>
        <Text style={styles.benefitLine}>• Reklamsız kullanım</Text>
        <Text style={styles.benefitLine}>• Sınırsız export akışı</Text>
        <Text style={styles.benefitLine}>• Genişletilmiş kaşe senaryoları</Text>
      </View>

      <View style={styles.planList}>
        <PlanCard
          title="Aylık"
          subtitle="Reklamsız kullanım, sınırsız export, çoklu kaşe."
          price="₺99 / ay"
          active={plan === 'monthly'}
          disabled={isBusy || plan === 'monthly'}
          onPress={() => handleChoosePlan('monthly')}
        />

        <PlanCard
          title="Yıllık"
          subtitle="Daha düşük maliyet, tam premium özellik seti."
          price="₺699 / yıl"
          active={plan === 'yearly'}
          disabled={isBusy || plan === 'yearly'}
          onPress={() => handleChoosePlan('yearly')}
        />

        <PlanCard
          title="Ömür boyu"
          subtitle="Tek ödeme ile kalıcı premium erişim."
          price="₺1499 tek sefer"
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
          <ActivityIndicator size="small" color="#35C76F" />
          <Text style={styles.busyText}>İşlem uygulanıyor...</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    color: '#94A3B8',
  },
  statusCard: {
    backgroundColor: '#121821',
    borderColor: '#243141',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  statusTitle: {
    color: '#F3F6FA',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  statusLine: {
    color: '#94A3B8',
    marginBottom: 4,
  },
  benefitCard: {
    backgroundColor: '#121821',
    borderColor: '#243141',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  benefitTitle: {
    color: '#F3F6FA',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  benefitLine: {
    color: '#94A3B8',
    lineHeight: 22,
  },
  planList: {
    gap: 12,
  },
  planCard: {
    backgroundColor: '#17202B',
    borderColor: '#263241',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  planCardActive: {
    backgroundColor: '#133121',
    borderColor: '#35C76F',
  },
  planCardDisabled: {
    opacity: 0.65,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 12,
  },
  planTitle: {
    color: '#F3F6FA',
    fontSize: 17,
    fontWeight: '800',
  },
  activeChip: {
    color: '#35C76F',
    fontSize: 12,
    fontWeight: '800',
  },
  planSubtitle: {
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 10,
  },
  planPrice: {
    color: '#35C76F',
    fontSize: 20,
    fontWeight: '900',
  },
  actionGroup: {
    gap: 10,
    marginTop: 18,
  },
  secondaryAction: {
    backgroundColor: '#17202B',
    borderColor: '#263241',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  secondaryActionText: {
    color: '#F3F6FA',
    textAlign: 'center',
    fontWeight: '700',
  },
  dangerAction: {
    backgroundColor: '#1F1720',
    borderColor: '#4B2632',
    borderWidth: 1,
    borderRadius: 14,
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
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  busyText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.92,
  },
});