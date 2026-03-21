import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
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

export type DocumentsOverviewItem = {
  key: string;
  title: string;
  subtitle: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'default' | 'accent' | 'success' | 'warning';
};

type Props = {
  items: DocumentsOverviewItem[];
};

function getPalette(tone: DocumentsOverviewItem['tone']) {
  switch (tone) {
    case 'accent':
      return {
        borderColor: 'rgba(59, 130, 246, 0.24)',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        iconBackground: 'rgba(59, 130, 246, 0.14)',
        iconColor: '#60A5FA',
        valueColor: '#60A5FA',
      };
    case 'success':
      return {
        borderColor: 'rgba(53, 199, 111, 0.28)',
        backgroundColor: 'rgba(53, 199, 111, 0.08)',
        iconBackground: 'rgba(53, 199, 111, 0.14)',
        iconColor: colors.primary,
        valueColor: colors.primary,
      };
    case 'warning':
      return {
        borderColor: 'rgba(245, 158, 11, 0.24)',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        iconBackground: 'rgba(245, 158, 11, 0.14)',
        iconColor: '#FBBF24',
        valueColor: '#FBBF24',
      };
    case 'default':
    default:
      return {
        borderColor: colors.border,
        backgroundColor: colors.card,
        iconBackground: colors.surfaceElevated,
        iconColor: colors.primary,
        valueColor: colors.text,
      };
  }
}

export function DocumentsOverviewStrip({ items }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {items.map((item) => {
        const palette = getPalette(item.tone);

        return (
          <View
            key={item.key}
            style={[
              styles.card,
              {
                borderColor: palette.borderColor,
                backgroundColor: palette.backgroundColor,
              },
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

            <Text style={[styles.value, { color: palette.valueColor }]}>
              {item.value}
            </Text>

            <View style={styles.textWrap}>
              <Text numberOfLines={1} style={styles.title}>
                {item.title}
              </Text>
              <Text numberOfLines={2} style={styles.subtitle}>
                {item.subtitle}
              </Text>
            </View>
          </View>
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
    width: 160,
    minHeight: 144,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...Typography.titleLarge,
    fontWeight: '900',
  },
  textWrap: {
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
});