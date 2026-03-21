import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

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

export function AssetLibraryItemCard({
  asset,
  selected,
  busy,
  subtitle,
  onPress,
}: {
  asset: StoredAsset;
  selected: boolean;
  busy?: boolean;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        busy && styles.disabled,
        pressed && !busy && styles.pressed,
      ]}
    >
      <View style={styles.previewWrap}>
        <Image
          source={{ uri: getPreferredAssetPreviewUri(asset) }}
          resizeMode="contain"
          style={styles.preview}
        />
      </View>

      <View style={styles.textBlock}>
        <Text numberOfLines={2} style={styles.name}>
          {asset.name}
        </Text>
        <Text style={styles.meta}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '31.6%',
    minWidth: 116,
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  previewWrap: {
    height: 108,
    borderRadius: Radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    gap: 4,
  },
  name: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
    lineHeight: 18,
  },
  meta: {
    ...Typography.caption,
    color: colors.textTertiary,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.92,
  },
});