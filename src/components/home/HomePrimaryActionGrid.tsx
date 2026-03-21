import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Pressable,
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

export type HomePrimaryActionItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  badge?: string | null;
  disabled?: boolean;
  ctaLabel?: string;
};

type Props = {
  featuredAction: HomePrimaryActionItem;
  secondaryActions: HomePrimaryActionItem[];
};

function SecondaryActionCard({
  item,
}: {
  item: HomePrimaryActionItem;
}) {
  return (
    <Pressable
      onPress={item.onPress}
      disabled={item.disabled}
      style={({ pressed }) => [
        styles.secondaryCard,
        pressed && !item.disabled && styles.pressed,
        item.disabled && styles.disabled,
      ]}
    >
      <View style={styles.secondaryTopRow}>
        <View style={styles.secondaryIconWrap}>
          <Ionicons name={item.icon} size={18} color={colors.primary} />
        </View>

        {item.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.secondaryTextWrap}>
        <Text numberOfLines={1} style={styles.secondaryTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={2} style={styles.secondarySubtitle}>
          {item.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export function HomePrimaryActionGrid({
  featuredAction,
  secondaryActions,
}: Props) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={featuredAction.onPress}
        disabled={featuredAction.disabled}
        style={({ pressed }) => [
          styles.featuredCard,
          pressed && !featuredAction.disabled && styles.pressed,
          featuredAction.disabled && styles.disabled,
        ]}
      >
        <View style={styles.featuredTopRow}>
          <View style={styles.featuredIconWrap}>
            <Ionicons
              name={featuredAction.icon}
              size={24}
              color={colors.primary}
            />
          </View>

          {featuredAction.badge ? (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>{featuredAction.badge}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.featuredTextWrap}>
          <Text style={styles.featuredEyebrow}>Ana işlem</Text>
          <Text style={styles.featuredTitle}>{featuredAction.title}</Text>
          <Text style={styles.featuredSubtitle}>{featuredAction.subtitle}</Text>
        </View>

        <View style={styles.featuredFooterRow}>
          <Text style={styles.featuredCtaText}>
            {featuredAction.ctaLabel ?? 'Hemen başlat'}
          </Text>
          <Ionicons
            name="arrow-forward-circle-outline"
            size={20}
            color={colors.primary}
          />
        </View>
      </Pressable>

      <View style={styles.secondaryGrid}>
        {secondaryActions.map((item) => (
          <SecondaryActionCard key={item.key} item={item} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  featuredCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  featuredTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  featuredIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBadge: {
    minHeight: 30,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(53, 199, 111, 0.28)',
    backgroundColor: 'rgba(53, 199, 111, 0.12)',
  },
  featuredBadgeText: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  featuredTextWrap: {
    gap: 6,
  },
  featuredEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  featuredTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  featuredSubtitle: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  featuredFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredCtaText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  secondaryCard: {
    width: '48.3%',
    minHeight: 116,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  secondaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  secondaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryTextWrap: {
    gap: 4,
  },
  secondaryTitle: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  secondarySubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  badge: {
    minHeight: 26,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.28)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  badgeText: {
    ...Typography.caption,
    color: '#60A5FA',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.58,
  },
});