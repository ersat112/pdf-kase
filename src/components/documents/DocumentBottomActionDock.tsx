import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
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

export type DocumentBottomActionDockItem = {
  key: string;
  label: string;
  caption: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

type Props = {
  actions: DocumentBottomActionDockItem[];
};

export function DocumentBottomActionDock({ actions }: Props) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        {actions.map((action) => {
          const isPrimary = (action.variant ?? 'secondary') === 'primary';

          return (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              disabled={action.disabled || action.loading}
              style={({ pressed }) => [
                styles.actionCard,
                isPrimary && styles.actionCardPrimary,
                pressed &&
                  !(action.disabled || action.loading) &&
                  styles.pressed,
                (action.disabled || action.loading) && styles.disabled,
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  isPrimary && styles.iconWrapPrimary,
                ]}
              >
                {action.loading ? (
                  <ActivityIndicator
                    size="small"
                    color={isPrimary ? colors.onPrimary : colors.primary}
                  />
                ) : (
                  <Ionicons
                    name={action.icon}
                    size={18}
                    color={isPrimary ? colors.onPrimary : colors.primary}
                  />
                )}
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  isPrimary && styles.labelPrimary,
                ]}
              >
                {action.label}
              </Text>

              <Text
                numberOfLines={2}
                style={[
                  styles.caption,
                  isPrimary && styles.captionPrimary,
                ]}
              >
                {action.caption}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  actionCard: {
    width: '23.5%',
    minHeight: 108,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  actionCardPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapPrimary: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  label: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  labelPrimary: {
    color: colors.onPrimary,
  },
  caption: {
    ...Typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  captionPrimary: {
    color: 'rgba(255,255,255,0.88)',
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.58,
  },
});