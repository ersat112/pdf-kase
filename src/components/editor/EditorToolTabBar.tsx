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

export type EditorToolTabKey = 'view' | 'format' | 'insert';

export type EditorToolTabItem = {
  key: EditorToolTabKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

type Props = {
  items: EditorToolTabItem[];
  activeKey: EditorToolTabKey;
  onChange: (key: EditorToolTabKey) => void;
};

export function EditorToolTabBar({
  items,
  activeKey,
  onChange,
}: Props) {
  return (
    <View style={styles.card}>
      {items.map((item) => {
        const active = item.key === activeKey;

        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              styles.tabButton,
              active && styles.tabButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={item.icon}
              size={18}
              color={active ? colors.onPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabButtonText,
                active && styles.tabButtonTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...Shadows.sm,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.92,
  },
});