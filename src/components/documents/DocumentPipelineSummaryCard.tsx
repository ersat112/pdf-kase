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

export type DocumentPipelineSummaryTone =
  | 'default'
  | 'success'
  | 'accent'
  | 'muted'
  | 'danger'
  | 'warning';

export type DocumentPipelineSummaryStat = {
  label: string;
  tone?: DocumentPipelineSummaryTone;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

export type DocumentPipelineSummaryAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  message: string;
  tone?: DocumentPipelineSummaryTone;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  stats?: DocumentPipelineSummaryStat[];
  actions?: DocumentPipelineSummaryAction[];
};

function getTonePalette(tone: DocumentPipelineSummaryTone) {
  switch (tone) {
    case 'success':
      return {
        containerBorder: 'rgba(53, 199, 111, 0.28)',
        containerBackground: 'rgba(53, 199, 111, 0.08)',
        iconBackground: 'rgba(53, 199, 111, 0.14)',
        iconColor: colors.primary,
        chipBackground: 'rgba(53, 199, 111, 0.12)',
        chipBorder: 'rgba(53, 199, 111, 0.28)',
        chipText: colors.primary,
      };
    case 'accent':
      return {
        containerBorder: 'rgba(59, 130, 246, 0.24)',
        containerBackground: 'rgba(59, 130, 246, 0.08)',
        iconBackground: 'rgba(59, 130, 246, 0.14)',
        iconColor: '#60A5FA',
        chipBackground: 'rgba(59, 130, 246, 0.12)',
        chipBorder: 'rgba(59, 130, 246, 0.28)',
        chipText: '#60A5FA',
      };
    case 'muted':
      return {
        containerBorder: 'rgba(148, 163, 184, 0.22)',
        containerBackground: 'rgba(148, 163, 184, 0.08)',
        iconBackground: 'rgba(148, 163, 184, 0.14)',
        iconColor: colors.textSecondary,
        chipBackground: 'rgba(148, 163, 184, 0.12)',
        chipBorder: 'rgba(148, 163, 184, 0.22)',
        chipText: colors.textSecondary,
      };
    case 'danger':
      return {
        containerBorder: 'rgba(239, 68, 68, 0.24)',
        containerBackground: 'rgba(239, 68, 68, 0.08)',
        iconBackground: 'rgba(239, 68, 68, 0.14)',
        iconColor: '#F87171',
        chipBackground: 'rgba(239, 68, 68, 0.12)',
        chipBorder: 'rgba(239, 68, 68, 0.24)',
        chipText: '#F87171',
      };
    case 'warning':
      return {
        containerBorder: 'rgba(245, 158, 11, 0.28)',
        containerBackground: 'rgba(245, 158, 11, 0.08)',
        iconBackground: 'rgba(245, 158, 11, 0.14)',
        iconColor: '#FBBF24',
        chipBackground: 'rgba(245, 158, 11, 0.12)',
        chipBorder: 'rgba(245, 158, 11, 0.24)',
        chipText: '#FBBF24',
      };
    case 'default':
    default:
      return {
        containerBorder: colors.border,
        containerBackground: colors.card,
        iconBackground: colors.surfaceElevated,
        iconColor: colors.primary,
        chipBackground: colors.surfaceElevated,
        chipBorder: colors.border,
        chipText: colors.textSecondary,
      };
  }
}

function StatChip({
  label,
  tone = 'default',
  icon,
}: DocumentPipelineSummaryStat) {
  const palette = getTonePalette(tone);

  return (
    <View
      style={[
        styles.statChip,
        {
          backgroundColor: palette.chipBackground,
          borderColor: palette.chipBorder,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={12} color={palette.chipText} />
      ) : null}

      <Text style={[styles.statChipText, { color: palette.chipText }]}>
        {label}
      </Text>
    </View>
  );
}

export function DocumentPipelineSummaryCard({
  title,
  subtitle,
  message,
  tone = 'default',
  icon = 'pulse-outline',
  stats = [],
  actions = [],
}: Props) {
  const palette = getTonePalette(tone);

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: palette.containerBorder,
          backgroundColor: palette.containerBackground,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: palette.iconBackground },
          ]}
        >
          <Ionicons name={icon} size={18} color={palette.iconColor} />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map((item) => (
            <StatChip
              key={`${item.label}-${item.tone ?? 'default'}`}
              {...item}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.message}>{message}</Text>

      {actions.length > 0 ? (
        <View style={styles.actionsRow}>
          {actions.map((action) => {
            const variant = action.variant ?? 'secondary';
            const isPrimary = variant === 'primary';

            return (
              <Pressable
                key={`${action.label}-${variant}`}
                disabled={action.disabled}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.actionButton,
                  isPrimary
                    ? styles.actionButtonPrimary
                    : styles.actionButtonSecondary,
                  pressed && !action.disabled && styles.pressed,
                  action.disabled && styles.actionButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    isPrimary
                      ? styles.actionButtonTextPrimary
                      : styles.actionButtonTextSecondary,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statChip: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statChipText: {
    ...Typography.caption,
    fontWeight: '800',
  },
  message: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionButtonTextPrimary: {
    color: colors.onPrimary,
  },
  actionButtonTextSecondary: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.92,
  },
});
