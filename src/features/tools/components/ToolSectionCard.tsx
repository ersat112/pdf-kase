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
} from '../../../theme';
import type { ToolDefinition, ToolSectionDefinition } from '../tools.types';

function AvailabilityBadge({
  availability,
}: {
  availability: ToolDefinition['availability'];
}) {
  const label =
    availability === 'ready'
      ? 'Hazır'
      : availability === 'shell'
        ? 'Shell'
        : 'Planlandı';

  return (
    <View
      style={[
        styles.badge,
        availability === 'ready' && styles.badgeReady,
        availability === 'shell' && styles.badgeShell,
        availability === 'planned' && styles.badgePlanned,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          availability === 'ready' && styles.badgeTextReady,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ToolRow({
  item,
  onPress,
}: {
  item: ToolDefinition;
  onPress: (tool: ToolDefinition) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowTextBlock}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <AvailabilityBadge availability={item.availability} />
        </View>

        <Text style={styles.rowDescription}>{item.shortDescription}</Text>
      </View>

      <Text style={styles.rowArrow}>›</Text>
    </Pressable>
  );
}

export function ToolSectionCard({
  section,
  onPressTool,
}: {
  section: ToolSectionDefinition;
  onPressTool: (tool: ToolDefinition) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionDescription}>{section.description}</Text>
      </View>

      <View style={styles.sectionCard}>
        {section.items.map((item, index) => (
          <View key={item.key}>
            <ToolRow item={item} onPress={onPressTool} />
            {index < section.items.length - 1 ? (
              <View style={styles.separator} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  sectionDescription: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  sectionCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    minHeight: 74,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowTextBlock: {
    flex: 1,
    gap: 6,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowTitle: {
    ...Typography.bodyMedium,
    color: colors.text,
    fontWeight: '700',
  },
  rowDescription: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  rowArrow: {
    color: colors.textTertiary,
    fontSize: 22,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: Spacing.lg,
  },
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeReady: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  badgeShell: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  badgePlanned: {
    backgroundColor: colors.backgroundMuted,
    borderColor: colors.border,
  },
  badgeText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  badgeTextReady: {
    color: colors.primaryForeground,
  },
  pressed: {
    opacity: 0.92,
  },
});