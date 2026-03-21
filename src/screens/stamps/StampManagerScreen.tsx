import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import {
  AssetLibraryDetailCard,
  type AssetLibraryAction,
} from '../../components/stamps/AssetLibraryDetailCard';
import { AssetLibraryItemCard } from '../../components/stamps/AssetLibraryItemCard';
import {
  formatAssetLibraryDate,
  getAssetLibraryHeroCopy,
  getAssetLibrarySelectionPills,
} from '../../modules/assets/asset-presentation';
import {
  createAssetFromImage,
  deleteAsset,
  getAssetsByType,
  getAssetUsageCount,
  hasAssetRestorableOriginal,
  parseAssetMetadata,
  renameAsset,
  restoreAssetOriginal,
  updateAssetImage,
  type AssetType,
  type StoredAsset,
} from '../../modules/assets/asset.service';
import { prepareStampAssetImage } from '../../modules/imaging/imaging.service';
import { canUseNativeStampCleanup } from '../../modules/imaging/stamp-cleanup.service';
import { removeFilesIfExist } from '../../modules/storage/file.service';
import { colors, Radius, Spacing, Typography } from '../../theme';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function AssetTabButton({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        active && styles.tabButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
        {title}
      </Text>
    </Pressable>
  );
}

function HeroPill({ label }: { label: string }) {
  return (
    <View style={styles.heroPill}>
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

function getCleanupModeLabel(metadata: Record<string, unknown>) {
  const mode = typeof metadata.cleanupMode === 'string' ? metadata.cleanupMode : null;

  switch (mode) {
    case 'native-background-removed':
      return 'Native temizleme uygulandı';
    case 'preserved-transparent-png':
      return 'Şeffaf PNG korundu';
    case 'native-unavailable':
      return 'Native cleanup yok';
    case 'original':
      return 'Orijinal görsel aktif';
    case 'optimized':
    default:
      return 'Optimize edilmiş';
  }
}

export function StampManagerScreen() {
  const nativeCleanupAvailable = canUseNativeStampCleanup();

  const [activeType, setActiveType] = useState<AssetType>('stamp');
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [selectedAssetUsageCount, setSelectedAssetUsageCount] = useState(0);
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const heroCopy = useMemo(
    () => getAssetLibraryHeroCopy(activeType, nativeCleanupAvailable),
    [activeType, nativeCleanupAvailable],
  );

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const selectedAssetMetadata = useMemo(
    () => parseAssetMetadata(selectedAsset?.metadata ?? null),
    [selectedAsset?.metadata],
  );

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await getAssetsByType(activeType);
      setAssets(rows);
      setSelectedAssetId((current) => {
        if (current && rows.some((item) => item.id === current)) {
          return current;
        }

        return rows[0]?.id ?? null;
      });
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Varlıklar yüklenemedi.'));
      setAssets([]);
      setSelectedAssetId(null);
    } finally {
      setLoading(false);
    }
  }, [activeType]);

  useFocusEffect(
    useCallback(() => {
      void loadAssets();
    }, [loadAssets]),
  );

  useEffect(() => {
    setRenameValue(selectedAsset?.name ?? '');
  }, [selectedAsset?.id, selectedAsset?.name]);

  useEffect(() => {
    let active = true;

    if (!selectedAsset || activeType !== 'stamp') {
      setSelectedAssetUsageCount(0);
      return;
    }

    const run = async () => {
      try {
        const usageCount = await getAssetUsageCount(selectedAsset.id);

        if (active) {
          setSelectedAssetUsageCount(usageCount);
        }
      } catch {
        if (active) {
          setSelectedAssetUsageCount(0);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [activeType, selectedAsset]);

  const handlePickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'İzin gerekli',
        permission.canAskAgain
          ? 'Görsel seçmek için galeri izni vermelisin.'
          : 'Galeri izni kapalı. Cihaz ayarlarından erişim iznini açmalısın.',
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 1,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets.length) {
      return null;
    }

    return result.assets[0].uri;
  }, []);

  const handleImportStamp = useCallback(async () => {
    try {
      setBusy(true);

      const pickedUri = await handlePickImage();

      if (!pickedUri) {
        return;
      }

      const prepared = await prepareStampAssetImage(pickedUri, {
        requestBackgroundCleanup: true,
      });

      try {
        const created = await createAssetFromImage({
          sourceUri: prepared.processedUri,
          originalSourceUri: pickedUri,
          previewSourceUri: prepared.previewUri,
          type: 'stamp',
          metadata: prepared.metadata,
        });

        await loadAssets();
        setSelectedAssetId(created.id);

        if (prepared.metadata.cleanupWarning) {
          Alert.alert('Bilgi', prepared.metadata.cleanupWarning);
        }
      } finally {
        await removeFilesIfExist([prepared.processedUri, prepared.previewUri]);
      }
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Kaşe eklenirken hata oluştu.'));
    } finally {
      setBusy(false);
    }
  }, [handlePickImage, loadAssets]);

  const handleRenameSelected = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }

    const nextName = renameValue.trim();

    if (!nextName) {
      Alert.alert('Eksik bilgi', 'Ad boş bırakılamaz.');
      return;
    }

    if (nextName === selectedAsset.name) {
      return;
    }

    try {
      setBusy(true);
      await renameAsset(selectedAsset.id, nextName);
      await loadAssets();
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Ad güncellenemedi.'));
    } finally {
      setBusy(false);
    }
  }, [loadAssets, renameValue, selectedAsset]);

  const handleOptimizeSelected = useCallback(async () => {
    if (!selectedAsset || activeType !== 'stamp') {
      return;
    }

    try {
      setBusy(true);

      const sourceUri = selectedAsset.original_file_path || selectedAsset.file_path;
      const prepared = await prepareStampAssetImage(sourceUri, {
        requestBackgroundCleanup: false,
      });

      try {
        await updateAssetImage({
          assetId: selectedAsset.id,
          sourceUri: prepared.processedUri,
          previewSourceUri: prepared.previewUri,
          metadataPatch: prepared.metadata,
          preserveOriginal: true,
        });

        await loadAssets();
      } finally {
        await removeFilesIfExist([prepared.processedUri, prepared.previewUri]);
      }
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Optimizasyon sırasında hata oluştu.'),
      );
    } finally {
      setBusy(false);
    }
  }, [activeType, loadAssets, selectedAsset]);

  const handleCleanupSelectedBackground = useCallback(async () => {
    if (!selectedAsset || activeType !== 'stamp') {
      return;
    }

    try {
      setBusy(true);

      const sourceUri = selectedAsset.original_file_path || selectedAsset.file_path;
      const prepared = await prepareStampAssetImage(sourceUri, {
        requestBackgroundCleanup: true,
      });

      try {
        await updateAssetImage({
          assetId: selectedAsset.id,
          sourceUri: prepared.processedUri,
          previewSourceUri: prepared.previewUri,
          metadataPatch: prepared.metadata,
          preserveOriginal: true,
        });

        await loadAssets();

        if (prepared.metadata.backgroundRemoved) {
          Alert.alert('Tamamlandı', 'Arka plan temizlenerek güncellendi.');
        } else if (prepared.metadata.cleanupWarning) {
          Alert.alert('Bilgi', prepared.metadata.cleanupWarning);
        } else if (!nativeCleanupAvailable) {
          Alert.alert(
            'Native cleanup hazır değil',
            'Bridge katmanı kurulu değil veya mevcut build içinde native cleanup modülü yok.',
          );
        } else {
          Alert.alert(
            'Temizleme uygulanmadı',
            'Bu kaşede uygulanabilir bir arka plan temizleme çıktısı üretilmedi.',
          );
        }
      } finally {
        await removeFilesIfExist([prepared.processedUri, prepared.previewUri]);
      }
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Arka plan temizlenemedi.'));
    } finally {
      setBusy(false);
    }
  }, [activeType, loadAssets, nativeCleanupAvailable, selectedAsset]);

  const handleReplaceSelectedImage = useCallback(async () => {
    if (!selectedAsset || activeType !== 'stamp') {
      return;
    }

    try {
      setBusy(true);

      const pickedUri = await handlePickImage();

      if (!pickedUri) {
        return;
      }

      const prepared = await prepareStampAssetImage(pickedUri, {
        requestBackgroundCleanup: true,
      });

      try {
        await updateAssetImage({
          assetId: selectedAsset.id,
          sourceUri: prepared.processedUri,
          previewSourceUri: prepared.previewUri,
          metadataPatch: prepared.metadata,
          preserveOriginal: false,
        });

        await loadAssets();

        if (prepared.metadata.cleanupWarning) {
          Alert.alert('Bilgi', prepared.metadata.cleanupWarning);
        }
      } finally {
        await removeFilesIfExist([prepared.processedUri, prepared.previewUri]);
      }
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Görsel güncellenemedi.'));
    } finally {
      setBusy(false);
    }
  }, [activeType, handlePickImage, loadAssets, selectedAsset]);

  const handleRestoreOriginalSelected = useCallback(async () => {
    if (!selectedAsset || activeType !== 'stamp') {
      return;
    }

    try {
      setBusy(true);
      await restoreAssetOriginal(selectedAsset.id);
      await loadAssets();
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Orijinal geri yüklenemedi.'));
    } finally {
      setBusy(false);
    }
  }, [activeType, loadAssets, selectedAsset]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedAsset) {
      return;
    }

    const assetLabel = activeType === 'stamp' ? 'kaşe' : 'imza';

    Alert.alert(
      `${assetLabel} sil`,
      `Bu ${assetLabel} öğesini silmek istediğine emin misin?`,
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              await deleteAsset(selectedAsset.id);
              await loadAssets();
            } catch (error) {
              Alert.alert(
                'Hata',
                getErrorMessage(error, `${assetLabel} silinirken hata oluştu.`),
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [activeType, loadAssets, selectedAsset]);

  const latestAssetDate = useMemo(() => {
    if (assets.length === 0) {
      return 'Yok';
    }

    return formatAssetLibraryDate(assets[0].created_at);
  }, [assets]);

  const restorable = selectedAsset ? hasAssetRestorableOriginal(selectedAsset) : false;
  const backgroundRemoved = selectedAssetMetadata.backgroundRemoved === true;
  const cleanupModeLabel = getCleanupModeLabel(selectedAssetMetadata);
  const cleanupProviderLabel =
    typeof selectedAssetMetadata.cleanupProvider === 'string' &&
    selectedAssetMetadata.cleanupProvider.trim().length > 0
      ? selectedAssetMetadata.cleanupProvider
      : nativeCleanupAvailable
        ? 'native hazır'
        : 'native yok';

  const selectionPills = useMemo(
    () =>
      getAssetLibrarySelectionPills({
        type: activeType,
        metadata: selectedAssetMetadata,
        usageCount: selectedAssetUsageCount,
        restorable,
        backgroundRemoved,
        cleanupModeLabel,
        cleanupProviderLabel,
      }),
    [
      activeType,
      backgroundRemoved,
      cleanupModeLabel,
      cleanupProviderLabel,
      restorable,
      selectedAssetMetadata,
      selectedAssetUsageCount,
    ],
  );

  const detailActionGroups = useMemo<AssetLibraryAction[][]>(() => {
    if (activeType === 'stamp') {
      return [
        [
          {
            key: 'optimize',
            label: 'Optimize et',
            onPress: handleOptimizeSelected,
            disabled: busy,
          },
          {
            key: 'cleanup',
            label: 'Arka planı temizle',
            onPress: handleCleanupSelectedBackground,
            disabled: busy,
          },
        ],
        [
          {
            key: 'replace',
            label: 'Görseli değiştir',
            onPress: handleReplaceSelectedImage,
            disabled: busy,
          },
          {
            key: 'restore',
            label: 'Orijinali geri yükle',
            onPress: handleRestoreOriginalSelected,
            disabled: busy || !restorable,
          },
        ],
        [
          {
            key: 'delete',
            label: heroCopy.deleteLabel,
            onPress: handleDeleteSelected,
            disabled: busy,
            tone: 'danger',
          },
        ],
      ];
    }

    return [
      [
        {
          key: 'delete',
          label: heroCopy.deleteLabel,
          onPress: handleDeleteSelected,
          disabled: busy,
          tone: 'danger',
        },
      ],
    ];
  }, [
    activeType,
    busy,
    handleCleanupSelectedBackground,
    handleDeleteSelected,
    handleOptimizeSelected,
    handleReplaceSelectedImage,
    handleRestoreOriginalSelected,
    heroCopy.deleteLabel,
    restorable,
  ]);

  return (
    <Screen
      title="Kaşe & İmzalar"
      subtitle="Kaşe kütüphanesini ve kaydettiğin imza küçük resimlerini yerel olarak yönet."
    >
      <View style={styles.tabRow}>
        <AssetTabButton
          title="Kaşeler"
          active={activeType === 'stamp'}
          onPress={() => setActiveType('stamp')}
        />
        <AssetTabButton
          title="İmzalarım"
          active={activeType === 'signature'}
          onPress={() => setActiveType('signature')}
        />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{heroCopy.title}</Text>
        <Text style={styles.heroText}>{heroCopy.description}</Text>

        <View style={styles.heroPillRow}>
          {heroCopy.pills.map((pill) => (
            <HeroPill key={pill} label={pill} />
          ))}
        </View>

        {heroCopy.primaryActionLabel ? (
          <Pressable
            onPress={handleImportStamp}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryButton,
              busy && styles.primaryButtonDisabled,
              pressed && !busy && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {busy ? 'Kaşe işleniyor...' : heroCopy.primaryActionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTextBlock}>
          <Text style={styles.summaryTitle}>{heroCopy.summaryTitle}</Text>
          <Text style={styles.summaryHint}>Son eklenen: {latestAssetDate}</Text>
        </View>

        <Text style={styles.summaryValue}>{assets.length}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{heroCopy.emptyTitle}</Text>
          <Text style={styles.emptyText}>{heroCopy.emptyText}</Text>
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {assets.map((asset) => (
              <AssetLibraryItemCard
                key={asset.id}
                asset={asset}
                selected={asset.id === selectedAssetId}
                busy={busy}
                subtitle={formatAssetLibraryDate(asset.created_at)}
                onPress={() => setSelectedAssetId(asset.id)}
              />
            ))}
          </View>

          {selectedAsset ? (
            <AssetLibraryDetailCard
              title={heroCopy.selectionTitle}
              asset={selectedAsset}
              renameValue={renameValue}
              onChangeRename={setRenameValue}
              onSaveRename={handleRenameSelected}
              namePlaceholder={heroCopy.namePlaceholder}
              createdAtLabel={formatAssetLibraryDate(selectedAsset.created_at)}
              note={heroCopy.note}
              pills={selectionPills}
              actionGroups={detailActionGroups}
              busy={busy}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tabButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  tabButtonActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(53, 199, 111, 0.12)',
  },
  tabButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: colors.primary,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  heroTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  heroText: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroPillText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  summaryTextBlock: {
    flex: 1,
    gap: 4,
  },
  summaryTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  summaryHint: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  emptyText: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  pressed: {
    opacity: 0.92,
  },
});
