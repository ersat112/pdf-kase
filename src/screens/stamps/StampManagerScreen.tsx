import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import {
  AssetLibraryDetailCard,
  type AssetLibraryAction,
} from '../../components/stamps/AssetLibraryDetailCard';
import { AssetLibraryItemCard } from '../../components/stamps/AssetLibraryItemCard';
import {
  AssetLibraryOverviewStrip,
  type AssetLibraryOverviewItem,
} from '../../components/stamps/AssetLibraryOverviewStrip';
import {
  formatAssetLibraryDate,
  getAssetLibraryComparisonPreview,
  getAssetLibraryHeroCopy,
  getAssetLibraryOperationFeedback,
  getAssetLibrarySelectionPills,
  type AssetLibraryOperationFeedback,
} from '../../modules/assets/asset-presentation';
import {
  getAssetLibraryScopeLabel,
  createAssetFromImage,
  deleteAsset,
  getAssetsByType,
  getAssetUsageCount,
  hasAssetRestorableOriginal,
  parseAssetMetadata,
  renameAsset,
  restoreAssetOriginal,
  updateAssetLibraryScope,
  updateAssetImage,
  type AssetLibraryScope,
  type AssetType,
  type StoredAsset,
} from '../../modules/assets/asset.service';
import { prepareStampAssetImage } from '../../modules/imaging/imaging.service';
import { canUseNativeStampCleanup } from '../../modules/imaging/stamp-cleanup.service';
import { removeFilesIfExist } from '../../modules/storage/file.service';
import {
  getWorkspaceDisplayName,
  getWorkspaceProfile,
  saveWorkspaceProfile,
  type WorkspaceProfile,
} from '../../modules/workspace/workspace.service';
import { useAuthStore } from '../../store/useAuthStore';
import {
  colors,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '../../theme';

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
  const refreshWorkspaceContext = useAuthStore((state) => state.refreshWorkspaceContext);

  const [activeType, setActiveType] = useState<AssetType>('stamp');
  const [activeScope, setActiveScope] = useState<AssetLibraryScope>('personal');
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [selectedAssetUsageCount, setSelectedAssetUsageCount] = useState(0);
  const [renameValue, setRenameValue] = useState('');
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(null);
  const [workspaceCompanyName, setWorkspaceCompanyName] = useState('');
  const [workspaceBranchName, setWorkspaceBranchName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [operationFeedback, setOperationFeedback] =
    useState<AssetLibraryOperationFeedback | null>(null);
  const effectiveAssetScope: AssetLibraryScope =
    activeType === 'stamp' ? activeScope : 'personal';

  const heroCopy = useMemo(
    () => getAssetLibraryHeroCopy(activeType, nativeCleanupAvailable),
    [activeType, nativeCleanupAvailable],
  );

  const workspaceDisplayName = useMemo(
    () => getWorkspaceDisplayName(workspaceProfile),
    [workspaceProfile],
  );

  const workspaceReady = Boolean(workspaceDisplayName);

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
      const [rows, workspace] = await Promise.all([
        getAssetsByType(activeType, {
          scope: activeType === 'stamp' ? effectiveAssetScope : 'personal',
        }),
        getWorkspaceProfile(),
      ]);
      setWorkspaceProfile(workspace);
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
  }, [activeType, effectiveAssetScope]);

  useFocusEffect(
    useCallback(() => {
      void loadAssets();
    }, [loadAssets]),
  );

  useEffect(() => {
    setRenameValue(selectedAsset?.name ?? '');
  }, [selectedAsset?.id, selectedAsset?.name]);

  useEffect(() => {
    setWorkspaceCompanyName(workspaceProfile?.company_name ?? '');
    setWorkspaceBranchName(workspaceProfile?.branch_name ?? '');
  }, [workspaceProfile?.branch_name, workspaceProfile?.company_name]);

  useEffect(() => {
    setOperationFeedback(null);
  }, [activeScope, activeType]);

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

  const handleSaveWorkspace = useCallback(async () => {
    try {
      setBusy(true);
      const saved = await saveWorkspaceProfile({
        companyName: workspaceCompanyName,
        branchName: workspaceBranchName,
      });
      await refreshWorkspaceContext();
      setWorkspaceProfile(saved);
      setOperationFeedback({
        title: 'Kurumsal kütüphane hazır',
        message:
          'Şirket profili kaydedildi. Artık kaşeleri kişisel veya kurumsal kütüphaneye ayırabilirsin.',
        tone: 'success',
      });
      await loadAssets();
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Şirket profili kaydedilemedi.'),
      );
    } finally {
      setBusy(false);
    }
  }, [loadAssets, refreshWorkspaceContext, workspaceBranchName, workspaceCompanyName]);

  const handleImportStamp = useCallback(async () => {
    try {
      setBusy(true);

      if (effectiveAssetScope === 'workspace' && !workspaceDisplayName) {
        Alert.alert(
          'Kurumsal kütüphane hazır değil',
          'Kurumsal kaşe eklemeden önce şirket profili alanını kaydetmelisin.',
        );
        return;
      }

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
          libraryScope: effectiveAssetScope,
          workspaceName:
            effectiveAssetScope === 'workspace' ? workspaceDisplayName : null,
          metadata: prepared.metadata,
        });

        await loadAssets();
        setSelectedAssetId(created.id);
        setOperationFeedback(
          getAssetLibraryOperationFeedback({
            type: 'stamp',
            operation: 'import',
            metadata: prepared.metadata,
          }),
        );
      } finally {
        await removeFilesIfExist([prepared.processedUri, prepared.previewUri]);
      }
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Kaşe eklenirken hata oluştu.'));
    } finally {
      setBusy(false);
    }
  }, [effectiveAssetScope, handlePickImage, loadAssets, workspaceDisplayName]);

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
      setOperationFeedback(
        getAssetLibraryOperationFeedback({
          type: activeType,
          operation: 'rename',
        }),
      );
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Ad güncellenemedi.'));
    } finally {
      setBusy(false);
    }
  }, [activeType, loadAssets, renameValue, selectedAsset]);

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
        setOperationFeedback(
          getAssetLibraryOperationFeedback({
            type: 'stamp',
            operation: 'optimize',
            metadata: prepared.metadata,
          }),
        );
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
        setOperationFeedback(
          getAssetLibraryOperationFeedback({
            type: 'stamp',
            operation: 'cleanup',
            metadata: prepared.metadata,
            nativeCleanupAvailable,
          }),
        );
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
        setOperationFeedback(
          getAssetLibraryOperationFeedback({
            type: 'stamp',
            operation: 'replace',
            metadata: prepared.metadata,
          }),
        );
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
      setOperationFeedback(
        getAssetLibraryOperationFeedback({
          type: 'stamp',
          operation: 'restore',
        }),
      );
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Orijinal geri yüklenemedi.'));
    } finally {
      setBusy(false);
    }
  }, [activeType, loadAssets, selectedAsset]);

  const handleMoveSelectedLibrary = useCallback(async () => {
    if (!selectedAsset || activeType !== 'stamp') {
      return;
    }

    const nextScope: AssetLibraryScope =
      selectedAsset.library_scope === 'workspace' ? 'personal' : 'workspace';

    if (nextScope === 'workspace' && !workspaceDisplayName) {
      Alert.alert(
        'Kurumsal kütüphane hazır değil',
        'Kaşeleri kurumsal kütüphaneye taşımadan önce şirket profilini kaydetmelisin.',
      );
      return;
    }

    try {
      setBusy(true);
      await updateAssetLibraryScope({
        assetId: selectedAsset.id,
        libraryScope: nextScope,
        workspaceName: nextScope === 'workspace' ? workspaceDisplayName : null,
      });
      await loadAssets();
      setOperationFeedback({
        title:
          nextScope === 'workspace'
            ? 'Kaşe kurumsal kütüphaneye taşındı'
            : 'Kaşe kişisel kütüphaneye taşındı',
        message:
          nextScope === 'workspace'
            ? 'Seçili kaşe ekip tarafında kullanılacak kurumsal havuza alındı.'
            : 'Seçili kaşe tekrar kişisel kütüphaneye alındı.',
        tone: 'success',
      });
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Kütüphane güncellenemedi.'));
    } finally {
      setBusy(false);
    }
  }, [activeType, loadAssets, selectedAsset, workspaceDisplayName]);

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
              setOperationFeedback(
                getAssetLibraryOperationFeedback({
                  type: activeType,
                  operation: 'delete',
                }),
              );
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

  const activeScopeLabel =
    effectiveAssetScope === 'workspace'
      ? workspaceDisplayName ?? 'Kurumsal'
      : 'Kişisel';

  const primaryActionLabel =
    activeType === 'stamp' && effectiveAssetScope === 'workspace'
      ? 'Kurumsal kaşe ekle'
      : heroCopy.primaryActionLabel;

  const emptyTitle =
    activeType === 'stamp' &&
    effectiveAssetScope === 'workspace' &&
    !workspaceReady
      ? 'Kurumsal kütüphane hazır değil'
      : heroCopy.emptyTitle;

  const emptyText =
    activeType === 'stamp' &&
    effectiveAssetScope === 'workspace' &&
    !workspaceReady
      ? 'Önce şirket adını kaydet. Sonrasında bu görünümde eklenen kaşeler kurumsal havuzda saklanır.'
      : heroCopy.emptyText;

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
      [
        `Kütüphane: ${
          selectedAsset ? getAssetLibraryScopeLabel(selectedAsset) : activeScopeLabel
        }`,
        ...getAssetLibrarySelectionPills({
          type: activeType,
          metadata: selectedAssetMetadata,
          usageCount: selectedAssetUsageCount,
          restorable,
          backgroundRemoved,
          cleanupModeLabel,
          cleanupProviderLabel,
        }),
      ],
    [
      activeScopeLabel,
      activeType,
      backgroundRemoved,
      cleanupModeLabel,
      cleanupProviderLabel,
      restorable,
      selectedAsset,
      selectedAssetMetadata,
      selectedAssetUsageCount,
    ],
  );

  const comparisonPreview = useMemo(
    () =>
      getAssetLibraryComparisonPreview({
        type: activeType,
        asset: selectedAsset,
        metadata: selectedAssetMetadata,
      }),
    [activeType, selectedAsset, selectedAssetMetadata],
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
            key: 'move-library',
            label:
              selectedAsset?.library_scope === 'workspace'
                ? 'Kişisele taşı'
                : 'Kurumsala taşı',
            onPress: handleMoveSelectedLibrary,
            disabled:
              busy ||
              !selectedAsset ||
              (selectedAsset.library_scope !== 'workspace' && !workspaceReady),
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
    handleMoveSelectedLibrary,
    heroCopy.deleteLabel,
    restorable,
    selectedAsset,
    workspaceReady,
  ]);

  const backgroundRemovedCount = useMemo(
    () =>
      assets.filter((asset) => {
        const metadata = parseAssetMetadata(asset.metadata ?? null);
        return metadata.backgroundRemoved === true;
      }).length,
    [assets],
  );

  const overviewItems = useMemo<AssetLibraryOverviewItem[]>(() => {
    if (activeType === 'stamp') {
      return [
        {
          key: 'total',
          title:
            effectiveAssetScope === 'workspace'
              ? 'Kurumsal kaşe'
              : 'Kişisel kaşe',
          subtitle: `${activeScopeLabel} görünümündeki aktif kayıt sayısı`,
          value: assets.length,
          icon: 'albums-outline',
          tone: 'accent',
        },
        {
          key: 'clean',
          title: 'Temizlenmiş',
          subtitle: 'Arka planı kaldırılmış sürümler',
          value: backgroundRemovedCount,
          icon: 'sparkles-outline',
          tone: backgroundRemovedCount > 0 ? 'success' : 'default',
        },
        {
          key: 'usage',
          title: 'Kullanım',
          subtitle: 'Seçili kaşenin yerleşim adedi',
          value: selectedAsset ? selectedAssetUsageCount : 0,
          icon: 'git-compare-outline',
          tone: selectedAssetUsageCount > 0 ? 'success' : 'default',
        },
        {
          key: 'native',
          title: 'Cleanup',
          subtitle: nativeCleanupAvailable ? 'Native modül hazır' : 'Native modül kapalı',
          value: nativeCleanupAvailable ? 'Hazır' : 'Yok',
          icon: 'hardware-chip-outline',
          tone: nativeCleanupAvailable ? 'success' : 'warning',
        },
      ];
    }

    const selectedStrokeCount =
      typeof selectedAssetMetadata.strokeCount === 'number'
        ? selectedAssetMetadata.strokeCount
        : 0;

    const selectedStrokeWidth =
      typeof selectedAssetMetadata.strokeWidth === 'number'
        ? selectedAssetMetadata.strokeWidth
        : 0;

    return [
      {
        key: 'total-signatures',
        title: 'Toplam imza',
        subtitle: 'Kayıtlı imza thumbnail sayısı',
        value: assets.length,
        icon: 'create-outline',
        tone: 'accent',
      },
      {
        key: 'stroke-count',
        title: 'Stroke',
        subtitle: 'Seçili imzanın stroke adedi',
        value: selectedAsset ? selectedStrokeCount : 0,
        icon: 'pulse-outline',
      },
      {
        key: 'stroke-width',
        title: 'Kalınlık',
        subtitle: 'Kaydedilen imza çizgi kalınlığı',
        value: selectedAsset ? selectedStrokeWidth : 0,
        icon: 'remove-outline',
      },
      {
        key: 'latest',
        title: 'Son eklenen',
        subtitle: 'Kütüphanedeki son kayıt',
        value: latestAssetDate === 'Yok' ? 'Yok' : 'Hazır',
        icon: 'time-outline',
        tone: latestAssetDate === 'Yok' ? 'warning' : 'success',
      },
    ];
  }, [
    activeScopeLabel,
    effectiveAssetScope,
    activeType,
    assets.length,
    backgroundRemovedCount,
    latestAssetDate,
    nativeCleanupAvailable,
    selectedAsset,
    selectedAssetMetadata.strokeCount,
    selectedAssetMetadata.strokeWidth,
    selectedAssetUsageCount,
  ]);

  return (
    <Screen
      title="Kaşe & İmzalar"
      subtitle="Yerel kütüphaneyi yönet, seçili varlığı düzelt ve editör akışına hazır tut."
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

      {activeType === 'stamp' ? (
        <View style={styles.scopeRow}>
          <AssetTabButton
            title="Kişisel"
            active={activeScope === 'personal'}
            onPress={() => setActiveScope('personal')}
          />
          <AssetTabButton
            title="Kurumsal"
            active={activeScope === 'workspace'}
            onPress={() => setActiveScope('workspace')}
          />
        </View>
      ) : null}

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroEyebrow}>Varlık kütüphanesi</Text>
            <Text style={styles.heroTitle}>{heroCopy.title}</Text>
            <Text style={styles.heroText}>{heroCopy.description}</Text>
          </View>

          <View style={styles.heroCountPill}>
            <Text style={styles.heroCountPillText}>{assets.length}</Text>
          </View>
        </View>

        <View style={styles.heroPillRow}>
          {heroCopy.pills.map((pill) => (
            <HeroPill key={pill} label={pill} />
          ))}
          {activeType === 'stamp' ? (
            <HeroPill label={`Aktif görünüm: ${activeScopeLabel}`} />
          ) : null}
        </View>

        {activeType === 'stamp' ? (
          <View style={styles.workspaceCard}>
            <View style={styles.workspaceHeader}>
              <View style={styles.workspaceTextWrap}>
                <Text style={styles.workspaceTitle}>Kurumsal kütüphane</Text>
                <Text style={styles.workspaceText}>
                  Şirket adını kaydet. Kurumsal görünümde eklenen kaşeler ekip
                  için ayrılmış yerel havuzda tutulur.
                </Text>
              </View>

              <View style={styles.workspaceStatusPill}>
                <Text style={styles.workspaceStatusPillText}>
                  {workspaceReady ? 'Hazır' : 'Bekliyor'}
                </Text>
              </View>
            </View>

            <View style={styles.workspaceInputGroup}>
              <View style={styles.workspaceInputBlock}>
                <Text style={styles.workspaceInputLabel}>Şirket</Text>
                <TextInput
                  value={workspaceCompanyName}
                  onChangeText={setWorkspaceCompanyName}
                  editable={!busy}
                  placeholder="Örn. Atlas Hukuk"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.workspaceInput}
                />
              </View>

              <View style={styles.workspaceInputBlock}>
                <Text style={styles.workspaceInputLabel}>Şube / birim</Text>
                <TextInput
                  value={workspaceBranchName}
                  onChangeText={setWorkspaceBranchName}
                  editable={!busy}
                  placeholder="Opsiyonel"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.workspaceInput}
                />
              </View>
            </View>

            <View style={styles.workspaceFooter}>
              <Text style={styles.workspaceFooterText}>
                {workspaceReady
                  ? `Aktif şirket profili: ${workspaceDisplayName}`
                  : 'Kurumsal kaşe kullanmadan önce bu profili kaydet.'}
              </Text>

              <Pressable
                onPress={handleSaveWorkspace}
                disabled={busy}
                style={({ pressed }) => [
                  styles.secondaryInlineButton,
                  busy && styles.primaryButtonDisabled,
                  pressed && !busy && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryInlineButtonText}>
                  {workspaceReady ? 'Profili güncelle' : 'Profili kaydet'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {primaryActionLabel ? (
          <Pressable
            onPress={handleImportStamp}
            disabled={busy || (effectiveAssetScope === 'workspace' && !workspaceReady)}
            style={({ pressed }) => [
              styles.primaryButton,
              (busy || (effectiveAssetScope === 'workspace' && !workspaceReady)) &&
                styles.primaryButtonDisabled,
              pressed &&
                !busy &&
                !(effectiveAssetScope === 'workspace' && !workspaceReady) &&
                styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {busy ? 'Kaşe işleniyor...' : primaryActionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <AssetLibraryOverviewStrip items={overviewItems} />

      <View style={styles.summaryCard}>
        <View style={styles.summaryTextBlock}>
          <Text style={styles.summaryTitle}>{heroCopy.summaryTitle}</Text>
          <Text style={styles.summaryHint}>
            Son eklenen: {latestAssetDate} • Görünüm: {activeScopeLabel}
          </Text>
        </View>

        <Text style={styles.summaryValue}>{assets.length}</Text>
      </View>

      {operationFeedback ? (
        <View
          style={[
            styles.feedbackCard,
            operationFeedback.tone === 'success'
              ? styles.feedbackCardSuccess
              : operationFeedback.tone === 'warning'
                ? styles.feedbackCardWarning
                : styles.feedbackCardNeutral,
          ]}
        >
          <Text style={styles.feedbackTitle}>{operationFeedback.title}</Text>
          <Text style={styles.feedbackText}>{operationFeedback.message}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kütüphane</Text>
            <Text style={styles.sectionHint}>
              {assets.length} kayıt • {activeScopeLabel}
            </Text>
          </View>

          <View style={styles.grid}>
            {assets.map((asset) => (
              <AssetLibraryItemCard
                key={asset.id}
                asset={asset}
                selected={asset.id === selectedAssetId}
                busy={busy}
                subtitle={formatAssetLibraryDate(asset.created_at)}
                badgeLabel={activeType === 'stamp' ? getAssetLibraryScopeLabel(asset) : null}
                onPress={() => {
                  setOperationFeedback(null);
                  setSelectedAssetId(asset.id);
                }}
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
              comparePreview={comparisonPreview}
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
  scopeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    ...Shadows.sm,
  },
  tabButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
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
    ...Shadows.sm,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  heroTextWrap: {
    flex: 1,
    gap: 6,
  },
  heroEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
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
  heroCountPill: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCountPillText: {
    ...Typography.titleSmall,
    color: colors.text,
    fontWeight: '900',
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
  workspaceCard: {
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
  },
  workspaceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  workspaceTextWrap: {
    flex: 1,
    gap: 4,
  },
  workspaceTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  workspaceText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  workspaceStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  workspaceStatusPillText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  workspaceInputGroup: {
    gap: Spacing.sm,
  },
  workspaceInputBlock: {
    gap: 6,
  },
  workspaceInputLabel: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  workspaceInput: {
    minHeight: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: Spacing.md,
  },
  workspaceFooter: {
    gap: Spacing.sm,
  },
  workspaceFooterText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  secondaryInlineButton: {
    minHeight: 42,
    alignSelf: 'flex-start',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryInlineButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
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
  feedbackCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: 6,
    ...Shadows.sm,
  },
  feedbackCardSuccess: {
    backgroundColor: 'rgba(22, 101, 52, 0.14)',
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },
  feedbackCardWarning: {
    backgroundColor: 'rgba(180, 83, 9, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  feedbackCardNeutral: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  feedbackTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  feedbackText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  sectionHint: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
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
    ...Shadows.sm,
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
