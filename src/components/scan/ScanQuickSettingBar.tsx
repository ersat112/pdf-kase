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

export type ScanQuickSettingItem = {
  key: string;
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  active?: boolean;
  onPress: () => void;
};

type Props = {
  items: ScanQuickSettingItem[];
};

export function ScanQuickSettingBar({ items }: Props) {
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
            styles.chip,
            item.active && styles.chipActive,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.chipInner}>
            {item.icon ? (
              <Ionicons
                name={item.icon}
                size={15}
                color={item.active ? colors.onPrimary : colors.textSecondary}
              />
            ) : null}
            <Text
              style={[
                styles.chipText,
                item.active && styles.chipTextActive,
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
    paddingRight: Spacing.md,
  },
  chip: {
    minHeight: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    ...Shadows.sm,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.92,
  },
});