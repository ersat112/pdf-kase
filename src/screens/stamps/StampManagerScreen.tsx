import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import {
  createAssetFromImage,
  deleteAsset,
  getAssetsByType,
  getAssetUsageCount,
  getPreferredAssetPreviewUri,
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

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Tarih yok';
  }

  return parsed.toLocaleString('tr-TR');
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function InfoPill({ label }: { label: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillText}>{label}</Text>
    </View>
  );
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

function AssetCard({
  asset,
  selected,
  busy,
  onPress,
}: {
  asset: StoredAsset;
  selected: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.assetCard,
        selected && styles.assetCardSelected,
        busy && styles.disabled,
        pressed && !busy && styles.pressed,
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

      <Text style={styles.assetMeta}>{formatDate(asset.created_at)}</Text>
    </Pressable>
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
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Arka plan temizlenemedi.'),
      );
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
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Görsel güncellenemedi.'),
      );
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
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Orijinal geri yüklenemedi.'),
      );
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

    return formatDate(assets[0].created_at);
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
        <Text style={styles.heroTitle}>
          {activeType === 'stamp' ? 'Kaşe kitaplığı' : 'İmza kitaplığı'}
        </Text>
        <Text style={styles.heroText}>
          {activeType === 'stamp'
            ? 'Şeffaf PNG en iyi sonucu verir. Native cleanup modülü build içinde varsa taranmış kaşelerde arka plan temizleme de uygulanır.'
            : 'İmza ekranında kaydettiğin imzalar burada küçük resim olarak görünür. İmza PDF üzerine eklendiğinde editörde tutup sürükleyebilirsin.'}
        </Text>

        <View style={styles.infoPillRow}>
          {activeType === 'stamp' ? (
            <>
              <InfoPill
                label={
                  nativeCleanupAvailable
                    ? 'Native cleanup hazır'
                    : 'Native cleanup beklemede'
                }
              />
              <InfoPill label="Yerel-first kaşe kütüphanesi" />
            </>
          ) : (
            <>
              <InfoPill label="Yerel imza thumbnail kütüphanesi" />
              <InfoPill label="PDF editörde sürükle-bırak" />
            </>
          )}
        </View>

        {activeType === 'stamp' ? (
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
              {busy ? 'Kaşe işleniyor...' : 'Yeni kaşe ekle'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTextBlock}>
          <Text style={styles.summaryTitle}>
            Toplam {activeType === 'stamp' ? 'kaşe' : 'imza'}
          </Text>
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
          <Text style={styles.emptyTitle}>
            Henüz {activeType === 'stamp' ? 'kaşe' : 'imza'} yok
          </Text>
          <Text style={styles.emptyText}>
            {activeType === 'stamp'
              ? 'Taranmış kaşe veya şeffaf PNG içe aktar. Aynı kaşeyi daha sonra tüm belgelerde tekrar kullanabilirsin.'
              : 'Bir belge editöründen Yeni imza ekle akışını aç ve kaydet. Kaydedilen imza burada thumbnail olarak görünecek.'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={asset.id === selectedAssetId}
                busy={busy}
                onPress={() => setSelectedAssetId(asset.id)}
              />
            ))}
          </View>

          {selectedAsset ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>
                Seçili {activeType === 'stamp' ? 'kaşe' : 'imza'}
              </Text>

              <Image
                source={{ uri: getPreferredAssetPreviewUri(selectedAsset) }}
                resizeMode="contain"
                style={styles.detailPreview}
              />

              <View style={styles.infoPillRow}>
                {activeType === 'stamp' ? (
                  <>
                    <InfoPill
                      label={
                        selectedAssetUsageCount > 0
                          ? `${selectedAssetUsageCount} yerleşimde kullanılıyor`
                          : 'Henüz yerleşimde kullanılmadı'
                      }
                    />
                    <InfoPill label={restorable ? 'Orijinale geri dönebilir' : 'Orijinal aktif'} />
                    <InfoPill label={backgroundRemoved ? 'Arka plan temizlenmiş' : 'Arka plan temizlenmedi'} />
                    <InfoPill label={cleanupModeLabel} />
                    <InfoPill label={`Kaynak: ${cleanupProviderLabel}`} />
                  </>
                ) : (
                  <>
                    <InfoPill label="İmza thumbnail kayıtlı" />
                    {typeof selectedAssetMetadata.strokeColor === 'string' ? (
                      <InfoPill label={`Renk: ${selectedAssetMetadata.strokeColor}`} />
                    ) : null}
                    {typeof selectedAssetMetadata.strokeCount === 'number' ? (
                      <InfoPill label={`${selectedAssetMetadata.strokeCount} stroke`} />
                    ) : null}
                  </>
                )}
              </View>

              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Ad</Text>
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  editable={!busy}
                  placeholder={activeType === 'stamp' ? 'Kaşe adı' : 'İmza adı'}
                  placeholderTextColor={colors.textTertiary}
                  style={styles.nameInput}
                />
              </View>

              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Oluşturulma</Text>
                <Text style={styles.metaValue}>{formatDate(selectedAsset.created_at)}</Text>
              </View>

              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Not</Text>
                <Text style={styles.metaValue}>
                  {activeType === 'stamp'
                    ? 'Bu kaşe editörde sürükle-bırak ile istenen koordinata yerleştirilir ve sonraki belgelerde tekrar kullanılabilir.'
                    : 'Bu imza, imza ekranında çizilip küçük resim olarak kaydedildi. Belge editöründe seçili imzayı tutup istediğin yere sürükleyebilir ve boyutlandırabilirsin.'}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  disabled={busy}
                  onPress={handleRenameSelected}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    busy && styles.disabled,
                    pressed && !busy && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Adı kaydet</Text>
                </Pressable>

                {activeType === 'stamp' ? (
                  <Pressable
                    disabled={busy}
                    onPress={handleOptimizeSelected}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      busy && styles.disabled,
                      pressed && !busy && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Optimize et</Text>
                  </Pressable>
                ) : null}
              </View>

              {activeType === 'stamp' ? (
                <>
                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={busy}
                      onPress={handleCleanupSelectedBackground}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        busy && styles.disabled,
                        pressed && !busy && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Arka planı temizle</Text>
                    </Pressable>

                    <Pressable
                      disabled={busy}
                      onPress={handleReplaceSelectedImage}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        busy && styles.disabled,
                        pressed && !busy && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Görseli değiştir</Text>
                    </Pressable>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={busy || !restorable}
                      onPress={handleRestoreOriginalSelected}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        (busy || !restorable) && styles.disabled,
                        pressed && !busy && restorable && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Orijinali geri yükle</Text>
                    </Pressable>

                    <Pressable
                      disabled={busy}
                      onPress={handleDeleteSelected}
                      style={({ pressed }) => [
                        styles.dangerButton,
                        busy && styles.disabled,
                        pressed && !busy && styles.pressed,
                      ]}
                    >
                      <Text style={styles.dangerButtonText}>Sil</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable
                    disabled={busy}
                    onPress={handleDeleteSelected}
                    style={({ pressed }) => [
                      styles.dangerButton,
                      busy && styles.disabled,
                      pressed && !busy && styles.pressed,
                    ]}
                  >
                    <Text style={styles.dangerButtonText}>İmzayı sil</Text>
                  </Pressable>
                </View>
              )}
            </View>
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
  assetCard: {
    width: '31%',
    minWidth: 112,
    backgroundColor: colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  assetCardSelected: {
    borderColor: colors.primary,
  },
  assetImage: {
    width: '100%',
    height: 88,
  },
  assetName: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  assetMeta: {
    ...Typography.caption,
    color: colors.textTertiary,
  },
  detailCard: {
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  detailTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  detailPreview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.lg,
    backgroundColor: colors.surfaceElevated,
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