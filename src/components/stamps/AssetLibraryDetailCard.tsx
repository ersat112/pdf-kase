import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AssetLibraryComparisonPreview } from '../../modules/assets/asset-presentation';
import {
  getPreferredAssetPreviewUri,
  type StoredAsset,
} from '../../modules/assets/asset.service';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

export type AssetLibraryAction = {
  key: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
};

function InfoPill({ label }: { label: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillText}>{label}</Text>
    </View>
  );
}

export function AssetLibraryDetailCard({
  title,
  asset,
  renameValue,
  onChangeRename,
  onSaveRename,
  namePlaceholder,
  createdAtLabel,
  note,
  pills,
  actionGroups,
  comparePreview,
  busy,
}: {
  title: string;
  asset: StoredAsset;
  renameValue: string;
  onChangeRename: (value: string) => void;
  onSaveRename: () => void;
  namePlaceholder: string;
  createdAtLabel: string;
  note: string;
  pills: string[];
  actionGroups: AssetLibraryAction[][];
  comparePreview?: AssetLibraryComparisonPreview | null;
  busy?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          Seçili varlığı yeniden adlandır, optimize et veya tekrar editör akışında kullan.
        </Text>
      </View>

      {comparePreview ? (
        <View style={styles.compareCard}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareTitle}>Önce / Sonra</Text>
            <Text style={styles.compareHelperText}>
              {comparePreview.helperText}
            </Text>
          </View>

          <View style={styles.compareRow}>
            <View style={styles.compareColumn}>
              <Text style={styles.compareLabel}>{comparePreview.beforeLabel}</Text>
              <Image
                source={{ uri: comparePreview.beforeUri }}
                resizeMode="contain"
                style={styles.comparePreview}
              />
            </View>

            <View style={styles.compareColumn}>
              <Text style={styles.compareLabel}>{comparePreview.afterLabel}</Text>
              <Image
                source={{ uri: comparePreview.afterUri }}
                resizeMode="contain"
                style={styles.comparePreview}
              />
            </View>
          </View>
        </View>
      ) : (
        <Image
          source={{ uri: getPreferredAssetPreviewUri(asset) }}
          resizeMode="contain"
          style={styles.preview}
        />
      )}

      <View style={styles.infoPillRow}>
        {pills.map((pill) => (
          <InfoPill key={pill} label={pill} />
        ))}
      </View>

      <View style={styles.metaBlock}>
        <Text style={styles.metaLabel}>Ad</Text>
        <TextInput
          value={renameValue}
          onChangeText={onChangeRename}
          editable={!busy}
          placeholder={namePlaceholder}
          placeholderTextColor={colors.textTertiary}
          style={styles.nameInput}
        />
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Oluşturulma</Text>
          <Text style={styles.metaValue}>{createdAtLabel}</Text>
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Not</Text>
          <Text style={styles.metaValue}>{note}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          disabled={busy}
          onPress={onSaveRename}
          style={({ pressed }) => [
            styles.secondaryButton,
            busy && styles.disabled,
            pressed && !busy && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Adı kaydet</Text>
        </Pressable>
      </View>

      {actionGroups.map((group, index) => (
        <View key={`action-group-${index}`} style={styles.actionRow}>
          {group.map((action) => (
            <Pressable
              key={action.key}
              disabled={action.disabled}
              onPress={action.onPress}
              style={({ pressed }) => [
                action.tone === 'danger'
                  ? styles.dangerButton
                  : styles.secondaryButton,
                action.disabled && styles.disabled,
                pressed && !action.disabled && styles.pressed,
              ]}
            >
              <Text
                style={
                  action.tone === 'danger'
                    ? styles.dangerButtonText
                    : styles.secondaryButtonText
                }
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    gap: 4,
  },
  title: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  preview: {
    width: '100%',
    height: 196,
    borderRadius: Radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareCard: {
    gap: Spacing.md,
  },
  compareHeader: {
    gap: 4,
  },
  compareTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  compareHelperText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  compareRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  compareColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
  compareLabel: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  comparePreview: {
    width: '100%',
    height: 188,
    borderRadius: Radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  infoPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoPillText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  metaGrid: {
    gap: Spacing.md,
  },
  metaBlock: {
    gap: 6,
  },
  metaLabel: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  metaValue: {
    ...Typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  nameInput: {
    minHeight: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    paddingHorizontal: Spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    minWidth: 140,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  secondaryButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  dangerButton: {
    flex: 1,
    minHeight: 46,
    minWidth: 140,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#4B2632',
    backgroundColor: '#2A1620',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  dangerButtonText: {
    ...Typography.bodySmall,
    color: '#FCA5A5',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.92,
  },
});