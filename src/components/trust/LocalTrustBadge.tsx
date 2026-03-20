import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography, colors } from '../../theme';

type LocalTrustBadgeProps = {
  compact?: boolean;
};

export function LocalTrustBadge({
  compact = false,
}: LocalTrustBadgeProps) {
  if (compact) {
    return (
      <View style={styles.compactCard}>
        <View style={styles.iconWrapCompact}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
        </View>

        <View style={styles.compactTextWrap}>
          <Text style={styles.compactTitle}>Local-first</Text>
          <Text style={styles.compactText}>
            Belgelerin cihazında kalır. Buluta zorunlu gönderim yok.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Güven rozeti</Text>
          <Text style={styles.subtitle}>
            Local-first belge akışı
          </Text>
        </View>
      </View>

      <Text style={styles.text}>
        Belgelerin cihazında tutulur. Uygulama buluta zorlamaz; tarama, düzenleme ve yönetim akışı yerel çalışma mantığıyla ilerler.
      </Text>

      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Cihazda kalır</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Bulut zorunlu değil</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Privacy odaklı</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  compactTextWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  compactTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  text: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  compactText: {
    ...Typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
  },
});