import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
    getPreferredAssetPreviewUri,
    type StoredAsset,
} from '../../modules/assets/asset.service';
import { Radius, Spacing, Typography, colors } from '../../theme';

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
    width: '31%',
    minWidth: 112,
    backgroundColor: colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(53, 199, 111, 0.06)',
  },
  previewWrap: {
    height: 96,
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
    fontWeight: '700',
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