import React from 'react';
import {
    Pressable,
    ScrollView,
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

export type ScanModeRailItem = {
  key: string;
  title: string;
  subtitle: string;
  active?: boolean;
  onPress: () => void;
};

type Props = {
  items: ScanModeRailItem[];
};

export function ScanModeRail({ items }: Props) {
  if (!items.length) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          style={({ pressed }) => [
            styles.card,
            item.active && styles.cardActive,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.textWrap}>
            <Text
              numberOfLines={1}
              style={[styles.title, item.active && styles.titleActive]}
            >
              {item.title}
            </Text>
            <Text
              numberOfLines={2}
              style={[
                styles.subtitle,
                item.active && styles.subtitleActive,
              ]}
            >
              {item.subtitle}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.md,
    paddingRight: Spacing.md,
  },
  card: {
    width: 176,
    minHeight: 96,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.md,
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  textWrap: {
    gap: 6,
  },
  title: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  titleActive: {
    color: colors.primary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  subtitleActive: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.92,
  },
});