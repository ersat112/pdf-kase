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
    Spacing,
    Typography,
    colors,
} from '../../theme';

export type DocumentChipItem = {
  key: string;
  label: string;
  selected?: boolean;
  onPress: () => void;
};

type Props = {
  items: DocumentChipItem[];
};

export function DocumentChipRow({ items }: Props) {
  if (items.length === 0) {
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
            styles.chip,
            item.selected && styles.chipSelected,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.chipInner}>
            <Text
              style={[
                styles.chipText,
                item.selected && styles.chipTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.sm,
  },
  chip: {
    minHeight: 34,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.92,
  },
});