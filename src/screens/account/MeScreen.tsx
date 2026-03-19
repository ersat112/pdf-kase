// src/screens/account/MeScreen.tsx
import React, { useMemo } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import type { AppTabScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/useAuthStore';
import { useBillingStore } from '../../store/useBillingStore';
import {
    Layout,
    Radius,
    Shadows,
    Spacing,
    Typography,
    colors,
} from '../../theme';

type Props = AppTabScreenProps<'MeTab'>;

type MenuItem = {
  title: string;
  subtitle?: string;
  onPress: () => void;
};

function MenuRow({ title, subtitle, onPress }: MenuItem) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>

      <Text style={styles.rowArrow}>›</Text>
    </Pressable>
  );
}

export function MeScreen({ navigation }: Props) {
  const session = useAuthStore((state) => state.session);
  const isPro = useBillingStore((state) => state.isPro);

  const handleNotReady = (title: string) => {
    Alert.alert('Hazır UI', `${title} akışı sonraki sprintte bağlanacak.`);
  };

  const menu = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Hesap',
        subtitle: 'Profil ve oturum bilgileri',
        onPress: () => handleNotReady('Hesap'),
      },
      {
        title: 'Eşitle',
        subtitle: 'Bulut senkronizasyon hazırlığı',
        onPress: () => handleNotReady('Eşitle'),
      },
      {
        title: 'Tara',
        subtitle: 'Tarama davranışları ve varsayılanlar',
        onPress: () => navigation.navigate('Settings'),
      },
      {
        title: 'Göster & PDF',
        subtitle: 'PDF gösterim ve çıktı tercihleri',
        onPress: () => navigation.navigate('Settings'),
      },
      {
        title: 'Yazıcım',
        subtitle: 'Yazdırma ve çıktı akışları',
        onPress: () => handleNotReady('Yazıcım'),
      },
      {
        title: 'Daha fazla ayar',
        subtitle: 'Uygulama genel ayarları',
        onPress: () => navigation.navigate('Settings'),
      },
      {
        title: 'Yardım',
        subtitle: 'Destek, rehber ve yardım merkezi',
        onPress: () => handleNotReady('Yardım'),
      },
      {
        title: 'Satın alınanları geri yükle',
        subtitle: 'Premium durumunu tekrar doğrula',
        onPress: () => navigation.navigate('Pricing'),
      },
      {
        title: 'Arkadaşlarınıza söyleyin',
        subtitle: 'Paylaşım ve yönlendirme akışı',
        onPress: () => handleNotReady('Arkadaşlarınıza söyleyin'),
      },
    ],
    [navigation],
  );

  const displayName = session?.user?.name?.trim() || 'Kullanıcı';
  const displayEmail = session?.user?.email?.trim() || 'E-posta yok';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <Text style={styles.eyebrow}>BEN</Text>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{displayEmail}</Text>

          <View style={styles.profileMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{isPro ? 'Premium' : 'Free'}</Text>
            </View>

            <Pressable
              onPress={() => navigation.navigate('Pricing')}
              style={({ pressed }) => [styles.profileAction, pressed && styles.pressed]}
            >
              <Text style={styles.profileActionText}>
                {isPro ? 'Planı yönet' : 'Premium’a geç'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.menuCard}>
          {menu.map((item, index) => (
            <View key={item.title}>
              <MenuRow
                title={item.title}
                subtitle={item.subtitle}
                onPress={item.onPress}
              />
              {index < menu.length - 1 ? <View style={styles.separator} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Layout.screenVerticalPadding,
    paddingBottom: 120,
    gap: Spacing.xl,
  },
  profileCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  eyebrow: {
    ...Typography.caption,
    color: colors.primary,
    letterSpacing: 1.1,
  },
  profileName: {
    ...Typography.display,
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
  },
  profileEmail: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  profileMetaRow: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  metaPillText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  profileAction: {
    minHeight: 42,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  profileActionText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  menuCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    minHeight: 62,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  rowSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  rowArrow: {
    color: colors.textTertiary,
    fontSize: 22,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: Spacing.lg,
  },
  pressed: {
    opacity: 0.92,
  },
});