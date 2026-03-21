import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Image,
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

export type DocumentPageStripItem = {
  key: string;
  label: string;
  imageUri?: string | null;
  onPress: () => void;
  isActive?: boolean;
  badge?: string | null;
};

type Props = {
  items: DocumentPageStripItem[];
  title?: string;
  subtitle?: string;
};

export function DocumentPageStrip({
  items,
  title,
  subtitle,
}: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      {title || subtitle ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}

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
              styles.itemCard,
              item.isActive && styles.itemCardActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.thumbWrap}>
              {item.imageUri ? (
                <Image
                  source={{ uri: item.imageUri }}
                  resizeMode="cover"
                  style={styles.thumb}
                />
              ) : (
                <View style={styles.thumbFallback}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={colors.textTertiary}
                  />
                </View>
              )}

              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.label,
                item.isActive && styles.labelActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  title: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  content: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  itemCard: {
    width: 92,
    gap: 8,
  },
  itemCardActive: {
    transform: [{ scale: 1.02 }],
  },
  thumbWrap: {
    width: 92,
    height: 122,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minHeight: 22,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(11, 15, 20, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.28)',
  },
  badgeText: {
    ...Typography.caption,
    color: '#BFDBFE',
    fontWeight: '800',
  },
  label: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelActive: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.92,
  },
});