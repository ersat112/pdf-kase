import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme';

export function SplashGateScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoBadge}>
        <Text style={styles.logoBadgeText}>PDF</Text>
      </View>

      <ActivityIndicator size="large" color={colors.primary} />

      <View style={styles.copyBlock}>
        <Text style={styles.title}>PDF Kaşe</Text>
        <Text style={styles.subtitle}>
          Oturum, premium durumu ve yerel veriler hazırlanıyor...
        </Text>

        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Local-first</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Mock auth / billing</Text>
          </View>
        </View>

        <Text style={styles.helperText}>
          Kapalı testte oturum ve premium doğrulaması cihaz içi mock katmanla çalışır.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 18,
  },
  logoBadge: {
    minWidth: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  logoBadgeText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  copyBlock: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 280,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  pill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  helperText: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 300,
  },
});
