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

type StampSizePreset = 'small' | 'medium' | 'large';

function ActionButton({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        danger && styles.actionButtonDanger,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          danger && styles.actionButtonTextDanger,
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

export function EditorInspectorPanel({
  selectedOverlayLabel,
  selectedOverlayMeta,
  selectedOverlayDetail,
  isSignature,
  signatureColor,
  signatureColors,
  onSelectSignatureColor,
  onScaleDown,
  onScaleUp,
  onApplyPreset,
  onOpacityDown,
  onOpacityUp,
  onApplyToAllPages,
  applyToAllPagesLabel,
  showApplyToAllPages,
  onDuplicate,
  onDelete,
  busy,
}: {
  selectedOverlayLabel: string | null;
  selectedOverlayMeta: string | null;
  selectedOverlayDetail: string | null;
  isSignature: boolean;
  signatureColor: string;
  signatureColors: readonly string[];
  onSelectSignatureColor: (color: string) => void;
  onScaleDown: () => void;
  onScaleUp: () => void;
  onApplyPreset: (preset: StampSizePreset) => void;
  onOpacityDown: () => void;
  onOpacityUp: () => void;
  onApplyToAllPages?: () => void;
  applyToAllPagesLabel?: string;
  showApplyToAllPages?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  if (!selectedOverlayLabel) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Biçimlendirme</Text>
        <Text style={styles.emptyText}>
          Önce canvas üzerinde bir kaşe veya imza seç.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Biçimlendirme</Text>
        <Text style={styles.overlayLabel}>{selectedOverlayLabel}</Text>
        {selectedOverlayMeta ? (
          <Text style={styles.meta}>{selectedOverlayMeta}</Text>
        ) : null}
        {selectedOverlayDetail ? (
          <Text style={styles.meta}>{selectedOverlayDetail}</Text>
        ) : null}
      </View>

      {isSignature ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İmza rengi</Text>
          <View style={styles.colorRow}>
            {signatureColors.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                selected={signatureColor === color}
                onPress={() => onSelectSignatureColor(color)}
                disabled={busy}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Boyut</Text>
        <View style={styles.row}>
          <ActionButton label="Küçült" onPress={onScaleDown} disabled={busy} />
          <ActionButton label="Büyüt" onPress={onScaleUp} disabled={busy} />
        </View>
        <View style={styles.row}>
          <ActionButton
            label="Preset: Küçük"
            onPress={() => onApplyPreset('small')}
            disabled={busy}
          />
          <ActionButton
            label="Preset: Orta"
            onPress={() => onApplyPreset('medium')}
            disabled={busy}
          />
          <ActionButton
            label="Preset: Büyük"
            onPress={() => onApplyPreset('large')}
            disabled={busy}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Opaklık</Text>
        <View style={styles.row}>
          <ActionButton
            label="Daha saydam"
            onPress={onOpacityDown}
            disabled={busy}
          />
          <ActionButton
            label="Daha belirgin"
            onPress={onOpacityUp}
            disabled={busy}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>İşlemler</Text>
        {showApplyToAllPages && onApplyToAllPages ? (
          <View style={styles.row}>
            <ActionButton
              label={applyToAllPagesLabel ?? 'Tüm sayfalara uygula'}
              onPress={onApplyToAllPages}
              disabled={busy}
            />
          </View>
        ) : null}
        <View style={styles.row}>
          <ActionButton label="Çoğalt" onPress={onDuplicate} disabled={busy} />
          <ActionButton
            label="Sil"
            onPress={onDelete}
            disabled={busy}
            danger
          />
        </View>
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
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    gap: 4,
  },
  title: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  overlayLabel: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  meta: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionButton: {
    minHeight: 38,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.24)',
  },
  actionButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  actionButtonTextDanger: {
    color: '#F87171',
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
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.56,
  },
});
