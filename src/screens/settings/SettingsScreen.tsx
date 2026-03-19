import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

export function SettingsScreen() {
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);

  const isPro = useBillingStore((state) => state.isPro);
  const plan = useBillingStore((state) => state.plan);
  const expiresAt = useBillingStore((state) => state.expiresAt);

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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hesap</Text>
        <SettingRow label="Ad" value={session?.user.name ?? 'Yerel kullanıcı'} />
        <SettingRow label="E-posta" value={session?.user.email ?? 'Tanımsız'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Premium</Text>
        <SettingRow label="Durum" value={isPro ? 'Aktif' : 'Free'} />
        <SettingRow label="Plan" value={plan} />
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