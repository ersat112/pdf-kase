import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    resolveDocumentIsFavorite,
    resolveDocumentPageCount,
    resolveDocumentPdfPath,
    resolveDocumentStatusLabel,
    resolveDocumentStatusTone,
    resolveDocumentThumbnailPath,
    resolveDocumentTitle,
    resolveDocumentWordPath,
} from '../../modules/documents/document-presentation';
import type { DocumentSummary } from '../../modules/documents/document.service';
import {
    Radius,
    Shadows,
    Spacing,
    Typography,
    colors,
} from '../../theme';

function StatusBadge({ item }: { item: DocumentSummary }) {
  const tone = resolveDocumentStatusTone(item);

  return (
    <View
      style={[
        styles.statusBadge,
        tone === 'success' && styles.statusBadgeSuccess,
        tone === 'accent' && styles.statusBadgeAccent,
        tone === 'muted' && styles.statusBadgeMuted,
        tone === 'danger' && styles.statusBadgeDanger,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          tone === 'success' && styles.statusBadgeTextSuccess,
          tone === 'accent' && styles.statusBadgeTextAccent,
          tone === 'muted' && styles.statusBadgeTextMuted,
          tone === 'danger' && styles.statusBadgeTextDanger,
        ]}
      >
        {resolveDocumentStatusLabel(item)}
      </Text>
    </View>
  );
}

export function DocumentLibraryCard({
  item,
  selectionMode,
  selected,
  renameOpen,
  renameValue,
  updatedAtLabel,
  onChangeRenameValue,
  onSubmitRename,
  onCancelRename,
  onOpen,
  onLongPress,
  onToggleFavorite,
}: {
  item: DocumentSummary;
  selectionMode: boolean;
  selected: boolean;
  renameOpen: boolean;
  renameValue: string;
  updatedAtLabel: string;
  onChangeRenameValue: (value: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onOpen: () => void;
  onLongPress: () => void;
  onToggleFavorite: () => void;
}) {
  const favorite = resolveDocumentIsFavorite(item);
  const title = resolveDocumentTitle(item);
  const pageCount = resolveDocumentPageCount(item);
  const thumbnailPath = resolveDocumentThumbnailPath(item);
  const hasPdf = Boolean(resolveDocumentPdfPath(item));
  const hasWord = Boolean(resolveDocumentWordPath(item));
  const tags = item.tag_names ?? [];

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpen}
        onLongPress={onLongPress}
        delayLongPress={220}
        style={({ pressed }) => [
          styles.cardMainPressable,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.thumbnailFrame}>
          {thumbnailPath ? (
            <Image
              source={{ uri: thumbnailPath }}
              resizeMode="cover"
              style={styles.thumbnail}
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons
                name="document-text-outline"
                size={22}
                color={colors.textTertiary}
              />
              <Text style={styles.thumbnailPlaceholderText}>
                Önizleme yok
              </Text>
            </View>
          )}

          {selected ? (
            <View style={styles.selectionBadge}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.primary}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardTitleWrap}>
              <Text numberOfLines={2} style={styles.cardTitle}>
                {title}
              </Text>

              <Text numberOfLines={1} style={styles.cardMetaLine}>
                {pageCount > 0 ? `${pageCount} sayfa` : 'Sayfa tabanlı değil'} •{' '}
                {updatedAtLabel}
              </Text>
            </View>

            <Ionicons
              name={
                selectionMode ? 'checkmark-done-outline' : 'chevron-forward'
              }
              size={20}
              color={selected ? colors.primary : colors.textTertiary}
            />
          </View>

          <View style={styles.cardBottomRow}>
            <StatusBadge item={item} />

            {favorite ? (
              <View style={styles.favoriteMiniBadge}>
                <Ionicons name="star" size={12} color={colors.primary} />
                <Text style={styles.favoriteMiniBadgeText}>Favori</Text>
              </View>
            ) : null}

            <View style={styles.inlineMiniBadge}>
              <Text style={styles.inlineMiniBadgeText}>LOCAL</Text>
            </View>

            {item.collection_name ? (
              <View style={styles.inlineMiniBadge}>
                <Text style={styles.inlineMiniBadgeText}>
                  {item.collection_name}
                </Text>
              </View>
            ) : null}

            {tags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.inlineMiniBadge}>
                <Text style={styles.inlineMiniBadgeText}>#{tag}</Text>
              </View>
            ))}

            {hasWord ? (
              <View style={styles.inlineMiniBadge}>
                <Text style={styles.inlineMiniBadgeText}>WORD</Text>
              </View>
            ) : null}

            {hasPdf ? (
              <View style={styles.inlineMiniBadge}>
                <Text style={styles.inlineMiniBadgeText}>PDF</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {!selectionMode ? (
        <View style={styles.cardActionRow}>
          <Pressable
            onPress={onToggleFavorite}
            style={({ pressed }) => [
              styles.inlineActionButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={favorite ? 'star' : 'star-outline'}
              size={16}
              color={favorite ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.inlineActionButtonText}>
              {favorite ? 'Favoriden çıkar' : 'Favori yap'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {renameOpen ? (
        <View style={styles.renameCard}>
          <Text style={styles.renameTitle}>Belge adını düzenle</Text>

          <TextInput
            value={renameValue}
            onChangeText={onChangeRenameValue}
            placeholder="Belge adı"
            placeholderTextColor={colors.textTertiary}
            style={styles.renameInput}
            autoFocus
            maxLength={120}
          />

          <View style={styles.renameActions}>
            <Pressable
              onPress={onCancelRename}
              style={({ pressed }) => [
                styles.renameSecondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.renameSecondaryButtonText}>Vazgeç</Text>
            </Pressable>

            <Pressable
              onPress={onSubmitRename}
              style={({ pressed }) => [
                styles.renamePrimaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.renamePrimaryButtonText}>Kaydet</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardMainPressable: {
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  thumbnailFrame: {
    width: 88,
    height: 118,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0F141B',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  selectionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.card,
    borderRadius: Radius.full,
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  thumbnailPlaceholderText: {
    color: colors.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  cardMetaLine: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  statusBadgeSuccess: {
    backgroundColor: 'rgba(53, 199, 111, 0.12)',
    borderColor: 'rgba(53, 199, 111, 0.28)',
  },
  statusBadgeAccent: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.28)',
  },
  statusBadgeMuted: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  statusBadgeDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.24)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  statusBadgeTextSuccess: {
    color: colors.primary,
  },
  statusBadgeTextAccent: {
    color: '#60A5FA',
  },
  statusBadgeTextMuted: {
    color: colors.textSecondary,
  },
  statusBadgeTextDanger: {
    color: '#F87171',
  },
  inlineMiniBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineMiniBadgeText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '800',
  },
  favoriteMiniBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  favoriteMiniBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  cardActionRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inlineActionButton: {
    minHeight: 36,
    alignSelf: 'flex-start',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineActionButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  renameCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },
  renameTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  renameInput: {
    minHeight: 46,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  renameActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  renamePrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renamePrimaryButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  renameSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameSecondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.92,
  },
});