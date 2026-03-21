import { Ionicons } from '@expo/vector-icons';
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
    getAssetLibraryScopeLabel,
    getPreferredAssetPreviewUri,
    type AssetType,
    type StoredAsset,
} from '../../modules/assets/asset.service';
import {
    Radius,
    Shadows,
    Spacing,
    Typography,
    colors,
} from '../../theme';

type StampSizePreset = 'small' | 'medium' | 'large';

type Props = {
  activeLibraryType: AssetType;
  onChangeLibraryType: (type: AssetType) => void;
  assets: StoredAsset[];
  selectedAssetId: number | null;
  onSelectAsset: (assetId: number) => void;
  stampSizePreset: StampSizePreset;
  onChangeStampSizePreset: (preset: StampSizePreset) => void;
  signaturePlacementColor: string;
  signatureColors: readonly string[];
  onSelectSignatureColor: (color: string) => void;
  busy?: boolean;
  onImportStamp: () => void;
  onOpenStampManager: () => void;
  onCreateSignature: () => void;
};

function SegmentedButton({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.segmentButton,
        active && styles.segmentButtonActive,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.segmentButtonText,
          active && styles.segmentButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ColorSwatch({
  color,
  selected,
  onPress,
  disabled,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.colorSwatch,
        selected && styles.colorSwatchSelected,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.colorSwatchInner, { backgroundColor: color }]} />
    </Pressable>
  );
}

export function EditorAssetTray({
  activeLibraryType,
  onChangeLibraryType,
  assets,
  selectedAssetId,
  onSelectAsset,
  stampSizePreset,
  onChangeStampSizePreset,
  signaturePlacementColor,
  signatureColors,
  onSelectSignatureColor,
  busy,
  onImportStamp,
  onOpenStampManager,
  onCreateSignature,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Ekle</Text>
          <Text style={styles.subtitle}>
            Varlığı seç, canvas üzerinde boş alana dokun ve sayfaya yerleştir.
          </Text>
        </View>

        <View style={styles.headerActionRow}>
          <Pressable
            onPress={activeLibraryType === 'stamp' ? onImportStamp : onCreateSignature}
            disabled={busy}
            style={({ pressed }) => [
              styles.headerActionButton,
              pressed && !busy && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Ionicons
              name={activeLibraryType === 'stamp' ? 'add-outline' : 'create-outline'}
              size={16}
              color={colors.onPrimary}
            />
            <Text style={styles.headerActionButtonText}>
              {activeLibraryType === 'stamp' ? 'Yeni kaşe' : 'Yeni imza'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onOpenStampManager}
            disabled={busy}
            style={({ pressed }) => [
              styles.secondaryActionButton,
              pressed && !busy && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Text style={styles.secondaryActionButtonText}>Kütüphane</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.segmentRow}>
        <SegmentedButton
          label="Kaşeler"
          active={activeLibraryType === 'stamp'}
          onPress={() => onChangeLibraryType('stamp')}
          disabled={busy}
        />
        <SegmentedButton
          label="İmzalarım"
          active={activeLibraryType === 'signature'}
          onPress={() => onChangeLibraryType('signature')}
          disabled={busy}
        />
      </View>

      {activeLibraryType === 'signature' ? (
        <View style={styles.subSection}>
          <Text style={styles.subSectionTitle}>İmza rengi</Text>
          <View style={styles.colorRow}>
            {signatureColors.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                selected={signaturePlacementColor === color}
                onPress={() => onSelectSignatureColor(color)}
                disabled={busy}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.subSection}>
        <Text style={styles.subSectionTitle}>Yeni öğe boyutu</Text>
        <View style={styles.segmentRow}>
          <SegmentedButton
            label="Küçük"
            active={stampSizePreset === 'small'}
            onPress={() => onChangeStampSizePreset('small')}
            disabled={busy}
          />
          <SegmentedButton
            label="Orta"
            active={stampSizePreset === 'medium'}
            onPress={() => onChangeStampSizePreset('medium')}
            disabled={busy}
          />
          <SegmentedButton
            label="Büyük"
            active={stampSizePreset === 'large'}
            onPress={() => onChangeStampSizePreset('large')}
            disabled={busy}
          />
        </View>
      </View>

      {assets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            Henüz {activeLibraryType === 'stamp' ? 'kaşe' : 'imza'} yok
          </Text>
          <Text style={styles.emptyText}>
            {activeLibraryType === 'stamp'
              ? 'Yeni kaşe ekleyip tekrar kullanılabilir kütüphane oluştur.'
              : 'İmza ekranında kaydettiğin imzalar burada görünür.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.assetContent}
        >
          {assets.map((asset) => {
            const selected = selectedAssetId === asset.id;

            return (
              <Pressable
                key={asset.id}
                onPress={() => onSelectAsset(asset.id)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.assetCard,
                  selected && styles.assetCardSelected,
                  pressed && !busy && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <Image
                  source={{ uri: getPreferredAssetPreviewUri(asset) }}
                  resizeMode="contain"
                  style={styles.assetImage}
                />
                <Text numberOfLines={2} style={styles.assetName}>
                  {asset.name}
                </Text>
                {activeLibraryType === 'stamp' ? (
                  <Text numberOfLines={1} style={styles.assetMeta}>
                    {getAssetLibraryScopeLabel(asset)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  headerRow: {
    gap: Spacing.md,
  },
  headerTextWrap: {
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
  headerActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  headerActionButton: {
    minHeight: 40,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerActionButtonText: {
    ...Typography.bodySmall,
    color: colors.onPrimary,
    fontWeight: '800',
  },
  secondaryActionButton: {
    minHeight: 40,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  segmentButton: {
    minHeight: 38,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  segmentButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  segmentButtonTextActive: {
    color: colors.onPrimary,
  },
  subSection: {
    gap: Spacing.sm,
  },
  subSectionTitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  colorSwatchInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  emptyCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    gap: 4,
  },
  emptyTitle: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  emptyText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  assetContent: {
    gap: Spacing.md,
  },
  assetCard: {
    width: 104,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.sm,
    gap: 8,
  },
  assetCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  assetImage: {
    width: '100%',
    height: 68,
  },
  assetName: {
    ...Typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  assetMeta: {
    ...Typography.caption,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.56,
  },
});
