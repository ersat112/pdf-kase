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

export type EditorPageStripItem = {
  key: string;
  label: string;
  imageUri: string;
  active?: boolean;
  onPress: () => void;
};

type Props = {
  title?: string;
  subtitle?: string;
  items: EditorPageStripItem[];
};

export function EditorPageStrip({
  title,
  subtitle,
  items,
}: Props) {
  if (!items.length) {
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
              item.active && styles.itemCardActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.thumbWrap}>
              <Image
                source={{ uri: item.imageUri }}
                resizeMode="cover"
                style={styles.thumb}
              />
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.label,
                item.active && styles.labelActive,
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
    width: 88,
    gap: 8,
  },
  itemCardActive: {
    transform: [{ scale: 1.02 }],
  },
  thumbWrap: {
    width: 88,
    height: 116,
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