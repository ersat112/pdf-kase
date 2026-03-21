import { Ionicons } from '@expo/vector-icons';
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

export type HomeSmartCollectionItem = {
  key: string;
  title: string;
  subtitle: string;
  count: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'default' | 'accent' | 'success' | 'warning';
  onPress?: () => void;
};

type Props = {
  items: HomeSmartCollectionItem[];
};

function getTonePalette(tone: HomeSmartCollectionItem['tone']) {
  switch (tone) {
    case 'accent':
      return {
        borderColor: 'rgba(59, 130, 246, 0.24)',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        iconBackground: 'rgba(59, 130, 246, 0.14)',
        iconColor: '#60A5FA',
        countColor: '#60A5FA',
      };
    case 'success':
      return {
        borderColor: 'rgba(53, 199, 111, 0.28)',
        backgroundColor: 'rgba(53, 199, 111, 0.08)',
        iconBackground: 'rgba(53, 199, 111, 0.14)',
        iconColor: colors.primary,
        countColor: colors.primary,
      };
    case 'warning':
      return {
        borderColor: 'rgba(245, 158, 11, 0.24)',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        iconBackground: 'rgba(245, 158, 11, 0.14)',
        iconColor: '#FBBF24',
        countColor: '#FBBF24',
      };
    case 'default':
    default:
      return {
        borderColor: colors.border,
        backgroundColor: colors.card,
        iconBackground: colors.surfaceElevated,
        iconColor: colors.textSecondary,
        countColor: colors.text,
      };
  }
}

export function HomeSmartCollectionsRow({ items }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {items.map((item) => {
        const palette = getTonePalette(item.tone);

        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            disabled={!item.onPress}
            style={({ pressed }) => [
              styles.card,
              {
                borderColor: palette.borderColor,
                backgroundColor: palette.backgroundColor,
              },
              pressed && item.onPress && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: palette.iconBackground },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={palette.iconColor}
              />
            </View>

            <View style={styles.textWrap}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>

            <Text style={[styles.count, { color: palette.countColor }]}>
              {item.count}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.md,
  },
  card: {
    width: 168,
    minHeight: 132,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  count: {
    ...Typography.titleLarge,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.92,
  },
});