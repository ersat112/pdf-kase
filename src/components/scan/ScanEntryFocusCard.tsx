import React from 'react';
import {
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    Radius,
    Shadows,
    Spacing,
    Typography,
    colors,
} from '../../theme';

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  helper: string;
  badges?: string[];
};

function FocusBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function ScanEntryFocusCard({
  eyebrow,
  title,
  description,
  helper,
  badges = [],
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.textWrap}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.helper}>{helper}</Text>
      </View>

      {badges.length > 0 ? (
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <FocusBadge key={badge} label={badge} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  textWrap: {
    gap: 6,
  },
  eyebrow: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  description: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  helper: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  badgeText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
  },
});