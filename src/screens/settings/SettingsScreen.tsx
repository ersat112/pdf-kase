import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import {
  getAuthSessionRuntimeLabel,
  isMockAuthSession,
} from '../../modules/auth/auth.service';
import {
  getBillingRuntimeLabel,
  isMockBillingState,
} from '../../modules/billing/billing.service';
import { type PdfImageQualityPreset } from '../../modules/imaging/imaging.service';
import { useAuthStore } from '../../store/useAuthStore';
import { useBillingStore } from '../../store/useBillingStore';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

function SettingRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onPress,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.toggleTextBlock}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {subtitle ? <Text style={styles.toggleSubtitle}>{subtitle}</Text> : null}
      </View>

      <View style={[styles.switchBase, value && styles.switchBaseActive]}>
        <View style={[styles.switchKnob, value && styles.switchKnobActive]} />
      </View>
    </Pressable>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'accent' | 'success' | 'warning';
}) {
  return (
    <View
      style={[
        styles.infoPill,
        tone === 'accent' && styles.infoPillAccent,
        tone === 'success' && styles.infoPillSuccess,
        tone === 'warning' && styles.infoPillWarning,
      ]}
    >
      <Text
        style={[
          styles.infoPillText,
          tone === 'accent' && styles.infoPillTextAccent,
          tone === 'success' && styles.infoPillTextSuccess,
          tone === 'warning' && styles.infoPillTextWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Yok';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Geçersiz';
  }

  return parsed.toLocaleString('tr-TR');
}

export function SettingsScreen() {
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);

  const isPro = useBillingStore((state) => state.isPro);
  const plan = useBillingStore((state) => state.plan);
  const expiresAt = useBillingStore((state) => state.expiresAt);
  const billingMetadata = useBillingStore((state) => state.metadata);

  const [busy, setBusy] = useState(false);

  const [scanQuality, setScanQuality] = useState<PdfImageQualityPreset>('balanced');
  const [recognitionLanguage, setRecognitionLanguage] = useState<
    'tr' | 'en' | 'multi'
  >('tr');
  const [saveOriginalsToPhotos, setSaveOriginalsToPhotos] = useState(false);
  const [saveScansToPhotos, setSaveScansToPhotos] = useState(false);
  const [startWithCamera, setStartWithCamera] = useState(true);
  const [lensTipsEnabled, setLensTipsEnabled] = useState(true);

  const formattedExpiry = useMemo(() => {
    if (!expiresAt) {
      return 'Yok';
    }

    const date = new Date(expiresAt);

    if (Number.isNaN(date.getTime())) {
      return 'Geçersiz';
    }

    return date.toLocaleString('tr-TR');
  }, [expiresAt]);

  const qualityDescription = useMemo(() => {
    switch (scanQuality) {
      case 'compact':
        return 'Daha küçük çıktı boyutu üretir.';
      case 'high':
        return 'Daha büyük ama daha net çıktı üretir.';
      case 'balanced':
      default:
        return 'Kalite ve dosya boyutu arasında dengeli çalışır.';
    }
  }, [scanQuality]);

  const authRuntimeLabel = useMemo(
    () => getAuthSessionRuntimeLabel(session),
    [session],
  );

  const billingRuntimeLabel = useMemo(
    () =>
      getBillingRuntimeLabel({
        isPro,
        plan,
        expiresAt,
        metadata: billingMetadata,
      }),
    [billingMetadata, expiresAt, isPro, plan],
  );

  const isMockSession = useMemo(() => isMockAuthSession(session), [session]);

  const isMockPremium = useMemo(
    () =>
      isMockBillingState({
        isPro,
        plan,
        expiresAt,
        metadata: billingMetadata,
      }),
    [billingMetadata, expiresAt, isPro, plan],
  );

  const sessionCreatedAt = session?.metadata?.createdAt ?? null;
  const billingUpdatedAt = billingMetadata?.updatedAt ?? null;

  const handleLogout = async () => {
    try {
      setBusy(true);
      await logout();
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Çıkış sırasında hata oluştu.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Ayarlar"
      subtitle="Tarama, tanıma ve cihaz içi oturum tercihlerini buradan yönet."
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>KAPALI TEST DURUMU</Text>
        <Text style={styles.heroTitle}>Runtime görünürlüğü</Text>
        <Text style={styles.heroText}>
          Bu build local-first çalışır. Oturum ve premium yüzeyleri testte mock
          katmanla doğrulanır; burada o runtime durumunu açıkça görürsün.
        </Text>

        <View style={styles.heroPillRow}>
          <InfoPill label={authRuntimeLabel} tone={isMockSession ? 'warning' : 'default'} />
          <InfoPill
            label={billingRuntimeLabel}
            tone={isMockPremium ? 'warning' : isPro ? 'success' : 'default'}
          />
          <InfoPill label={isPro ? 'Premium aktif' : 'Free plan'} tone={isPro ? 'success' : 'accent'} />
        </View>
      </View>

      <View style={styles.runtimeNoticeCard}>
        <View style={styles.runtimeNoticeTextWrap}>
          <Text style={styles.runtimeNoticeTitle}>Test modu açıklaması</Text>
          <Text style={styles.runtimeNoticeText}>
            {isMockSession || isMockPremium
              ? 'Bu cihazdaki oturum veya premium durumu gerçek provider yerine mock runtime ile çalışıyor. Amaç kapalı testte ürün akışlarını doğrulamak.'
              : 'Bu oturum ve premium durumu mock olarak işaretlenmedi.'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hesap</Text>
        <SettingRow label="Ad" value={session?.user.name ?? 'Yerel kullanıcı'} />
        <SettingRow label="E-posta" value={session?.user.email ?? 'Tanımsız'} />
        <SettingRow label="Oturum türü" value={authRuntimeLabel} />
        <SettingRow label="Oturum oluşturulma" value={formatDateTime(sessionCreatedAt)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Premium</Text>
        <SettingRow label="Durum" value={isPro ? 'Aktif' : 'Free'} />
        <SettingRow label="Plan" value={plan} />
        <SettingRow label="Runtime" value={billingRuntimeLabel} />
        <SettingRow label="Güncellenme" value={formatDateTime(billingUpdatedAt)} />
        <SettingRow label="Bitiş" value={formattedExpiry} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tarama kalitesi ve boyutu</Text>

        <View style={styles.chipRow}>
          <ChoiceChip
            label="Kompakt"
            selected={scanQuality === 'compact'}
            onPress={() => setScanQuality('compact')}
          />
          <ChoiceChip
            label="Dengeli"
            selected={scanQuality === 'balanced'}
            onPress={() => setScanQuality('balanced')}
          />
          <ChoiceChip
            label="Yüksek"
            selected={scanQuality === 'high'}
            onPress={() => setScanQuality('high')}
          />
        </View>

        <Text style={styles.cardHint}>{qualityDescription}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tanıma dili</Text>

        <View style={styles.chipRow}>
          <ChoiceChip
            label="Türkçe"
            selected={recognitionLanguage === 'tr'}
            onPress={() => setRecognitionLanguage('tr')}
          />
          <ChoiceChip
            label="İngilizce"
            selected={recognitionLanguage === 'en'}
            onPress={() => setRecognitionLanguage('en')}
          />
          <ChoiceChip
            label="Çok dilli"
            selected={recognitionLanguage === 'multi'}
            onPress={() => setRecognitionLanguage('multi')}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tarama sonrası davranış</Text>

        <ToggleRow
          title="Orijinal görüntüleri Fotoğraflar’a kaydet"
          subtitle="Ham giriş görsellerini cihaz galerisine yazar."
          value={saveOriginalsToPhotos}
          onPress={() => setSaveOriginalsToPhotos((value) => !value)}
        />

        <View style={styles.separator} />

        <ToggleRow
          title="Taramaları Fotoğraflar’a kaydet"
          subtitle="İyileştirilmiş çıktı görsellerini galeride tutar."
          value={saveScansToPhotos}
          onPress={() => setSaveScansToPhotos((value) => !value)}
        />

        <View style={styles.separator} />

        <ToggleRow
          title="Kamera ile başlat"
          subtitle="Tara akışında varsayılan olarak kamera seçili açılır."
          value={startWithCamera}
          onPress={() => setStartWithCamera((value) => !value)}
        />

        <View style={styles.separator} />

        <ToggleRow
          title="Lens temizleme ipuçları"
          subtitle="Tarama öncesi kısa kamera kalite hatırlatmaları gösterir."
          value={lensTipsEnabled}
          onPress={() => setLensTipsEnabled((value) => !value)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kaşe işleme</Text>
        <Text style={styles.cardText}>
          Kaşe kütüphanesi yerel optimizasyon, önizleme üretimi ve orijinale dönüş
          akışına hazır. Arka planı gerçekten temizlemek için şeffaf PNG kullanmak
          en doğru üretim akışıdır.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Durum</Text>
        <Text style={styles.cardText}>
          Bu ekran local-first ayar shell’i olarak hazırlandı. Persist edilen ayar
          store’u sonraki turda bağlanabilir.
        </Text>
      </View>

      <Pressable
        disabled={busy}
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          busy && styles.logoutButtonDisabled,
          pressed && !busy && styles.pressed,
        ]}
      >
        <Text style={styles.logoutButtonText}>
          {busy ? 'Çıkış yapılıyor...' : 'Çıkış yap'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  heroEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    letterSpacing: 1.1,
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
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  infoPill: {
    minHeight: 30,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  infoPillAccent: {
    borderColor: 'rgba(59, 130, 246, 0.28)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  infoPillSuccess: {
    borderColor: 'rgba(53, 199, 111, 0.28)',
    backgroundColor: 'rgba(53, 199, 111, 0.12)',
  },
  infoPillWarning: {
    borderColor: 'rgba(245, 158, 11, 0.24)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  infoPillText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoPillTextAccent: {
    color: '#60A5FA',
  },
  infoPillTextSuccess: {
    color: colors.primary,
  },
  infoPillTextWarning: {
    color: '#FBBF24',
  },
  runtimeNoticeCard: {
    backgroundColor: colors.card,
    borderColor: 'rgba(245, 158, 11, 0.22)',
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  runtimeNoticeTextWrap: {
    gap: 4,
  },
  runtimeNoticeTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  runtimeNoticeText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  cardText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  cardHint: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  settingRow: {
    gap: 2,
  },
  settingLabel: {
    ...Typography.caption,
    color: colors.textTertiary,
  },
  settingValue: {
    ...Typography.body,
    color: colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.onPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  toggleTextBlock: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  toggleSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  switchBase: {
    width: 50,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  switchBaseActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
  },
  switchKnobActive: {
    alignSelf: 'flex-end',
    backgroundColor: colors.onPrimary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: Spacing.xs,
  },
  logoutButton: {
    backgroundColor: '#1F1720',
    borderColor: '#4B2632',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  logoutButtonDisabled: {
    opacity: 0.65,
  },
  logoutButtonText: {
    ...Typography.label,
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.92,
  },
});
