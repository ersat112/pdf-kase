// src/screens/documents/DocumentsScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
  DocumentChipRow,
  type DocumentChipItem,
} from '../../components/documents/DocumentChipRow';
import { DocumentLibraryCard } from '../../components/documents/DocumentLibraryCard';
import { DocumentPipelineSummaryCard } from '../../components/documents/DocumentPipelineSummaryCard';
import {
  DocumentsOverviewStrip,
  type DocumentsOverviewItem,
} from '../../components/documents/DocumentsOverviewStrip';
import { LocalTrustBadge } from '../../components/trust/LocalTrustBadge';
import {
  getPremiumGateMessage,
  resolveBillingCapabilities,
} from '../../modules/billing/billing-capabilities';
import { logDocumentAuditEvent } from '../../modules/documents/document-audit.service';
import {
  buildDocumentCollectionOverview,
  buildDocumentsRecoverySummary,
  resolveDocumentActionState,
  resolveDocumentIsFavorite,
  resolveDocumentPageCount,
  resolveDocumentPdfPath,
  resolveDocumentStatusLabel,
  resolveDocumentTitle,
} from '../../modules/documents/document-presentation';
import {
  addTagToDocuments,
  listDocumentCollections,
  listDocumentTags,
  setDocumentsCollection,
  type DocumentCollectionSummary,
  type DocumentTagSummary,
} from '../../modules/documents/document-taxonomy.service';
import {
  exportDocumentToPdf,
  extractDocumentText,
  getRecentDocuments,
  mergeDocuments,
  renameDocumentTitle,
  setDocumentFavorite,
  setDocumentsFavorite,
  type DocumentSummary,
} from '../../modules/documents/document.service';
import type { RootNavigationProp } from '../../navigation/types';
import { useBillingStore } from '../../store/useBillingStore';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

type FilterKey =
  | 'all'
  | 'draft'
  | 'ready'
  | 'ocr'
  | 'processing'
  | 'failed'
  | 'pdf'
  | 'favorite';

type BatchActionKey = 'ocr' | 'pdf';

type BatchResult = {
  key: BatchActionKey;
  title: string;
  completedAt: string;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  failedTitles: string[];
  skippedTitles: string[];
  retryDocumentIds: number[];
  extraLine?: string | null;
};

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Tarih yok';
  }

  return parsed.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function matchesFilter(item: DocumentSummary, filter: FilterKey) {
  const actionState = resolveDocumentActionState(item);

  switch (filter) {
    case 'draft':
      return item.status === 'draft';
    case 'ready':
      return item.status === 'ready';
    case 'ocr':
      return item.ocr_status === 'ready';
    case 'processing':
      return actionState === 'processing';
    case 'failed':
      return actionState === 'failed';
    case 'pdf':
      return Boolean(resolveDocumentPdfPath(item));
    case 'favorite':
      return resolveDocumentIsFavorite(item);
    case 'all':
    default:
      return true;
  }
}

function formatBatchSummaryText(result: BatchResult) {
  const lines = [
    `Başarılı: ${result.succeededCount}`,
    `Hatalı: ${result.failedCount}`,
    `Atlanan: ${result.skippedCount}`,
  ];

  if (result.extraLine) {
    lines.push(result.extraLine);
  }

  if (result.failedTitles.length > 0) {
    const preview = result.failedTitles.slice(0, 3).join(', ');
    const suffix =
      result.failedTitles.length > 3
        ? ` +${result.failedTitles.length - 3}`
        : '';
    lines.push(`Hata: ${preview}${suffix}`);
  }

  if (result.skippedTitles.length > 0) {
    const preview = result.skippedTitles.slice(0, 3).join(', ');
    const suffix =
      result.skippedTitles.length > 3
        ? ` +${result.skippedTitles.length - 3}`
        : '';
    lines.push(`Atlanan: ${preview}${suffix}`);
  }

  return lines.join('\n');
}

function EmptyState({
  onCreate,
  onImport,
}: {
  onCreate: () => void;
  onImport: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name="document-text-outline"
          size={28}
          color={colors.textTertiary}
        />
      </View>

      <Text style={styles.emptyTitle}>Henüz belge yok</Text>
      <Text style={styles.emptyText}>
        İlk taramayı başlatabilir veya PDF / görsel dosyalarını içe aktararak
        belge havuzunu oluşturabilirsin.
      </Text>

      <View style={styles.emptyActionRow}>
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Yeni tarama</Text>
        </Pressable>

        <Pressable
          onPress={onImport}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>PDF içe aktar</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function DocumentsScreen() {
  const navigation = useNavigation<RootNavigationProp<'Documents'>>();

  const billingHydrated = useBillingStore((state) => state.hydrated);
  const isPro = useBillingStore((state) => state.isPro);
  const plan = useBillingStore((state) => state.plan);
  const expiresAt = useBillingStore((state) => state.expiresAt);

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [collections, setCollections] = useState<DocumentCollectionSummary[]>([]);
  const [tags, setTags] = useState<DocumentTagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [renameTargetId, setRenameTargetId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [collectionInput, setCollectionInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  const capabilities = useMemo(
    () =>
      resolveBillingCapabilities({
        isPro,
        plan,
        expiresAt,
      }),
    [expiresAt, isPro, plan],
  );

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);

      const [documentRows, collectionRows, tagRows] = await Promise.all([
        getRecentDocuments(100),
        listDocumentCollections(),
        listDocumentTags(),
      ]);

      setDocuments(documentRows);
      setCollections(collectionRows);
      setTags(tagRows);
    } catch (error) {
      console.warn('[Documents] Load failed:', error);
      setDocuments([]);
      setCollections([]);
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDocuments();
    }, [loadDocuments]),
  );

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => documents.some((item) => item.id === id)),
    );

    if (
      renameTargetId !== null &&
      !documents.some((item) => item.id === renameTargetId)
    ) {
      setRenameTargetId(null);
      setRenameValue('');
    }

    if (
      selectedCollectionName &&
      !collections.some((item) => item.name === selectedCollectionName)
    ) {
      setSelectedCollectionName(null);
    }

    if (
      selectedTagName &&
      !tags.some((item) => item.name === selectedTagName)
    ) {
      setSelectedTagName(null);
    }
  }, [collections, documents, renameTargetId, selectedCollectionName, selectedTagName, tags]);

  const selectionMode = selectedIds.length > 0;

  const overview = useMemo(
    () => buildDocumentCollectionOverview(documents),
    [documents],
  );

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');

    return [...overview.sortedDocuments]
      .filter((item) => {
        if (!matchesFilter(item, filter)) {
          return false;
        }

        if (
          selectedCollectionName &&
          item.collection_name !== selectedCollectionName
        ) {
          return false;
        }

        if (
          selectedTagName &&
          !item.tag_names.some((tag) => tag === selectedTagName)
        ) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          resolveDocumentTitle(item),
          item.status,
          item.ocr_status,
          resolveDocumentStatusLabel(item),
          item.collection_name ?? '',
          ...item.tag_names,
          resolveDocumentIsFavorite(item) ? 'favori' : '',
          'local',
          'cihazda kalır',
        ]
          .join(' ')
          .toLocaleLowerCase('tr-TR');

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        const favoriteDelta =
          Number(resolveDocumentIsFavorite(right)) -
          Number(resolveDocumentIsFavorite(left));

        if (favoriteDelta !== 0) {
          return favoriteDelta;
        }

        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      });
  }, [filter, overview.sortedDocuments, query, selectedCollectionName, selectedTagName]);

  const selectedDocuments = useMemo(() => {
    return documents.filter((item) => selectedIds.includes(item.id));
  }, [documents, selectedIds]);

  const eligibleBatchDocuments = useMemo(() => {
    return selectedDocuments.filter((item) => resolveDocumentPageCount(item) > 0);
  }, [selectedDocuments]);

  const skippedBatchDocuments = useMemo(() => {
    return selectedDocuments.filter((item) => resolveDocumentPageCount(item) <= 0);
  }, [selectedDocuments]);

  const retryableSelectedFailedDocuments = useMemo(() => {
    return selectedDocuments.filter(
      (item) =>
        resolveDocumentPageCount(item) > 0 &&
        resolveDocumentActionState(item) === 'failed',
    );
  }, [selectedDocuments]);

  const failedVisibleDocuments = useMemo(() => {
    return filteredDocuments.filter(
      (item) =>
        resolveDocumentPageCount(item) > 0 &&
        resolveDocumentActionState(item) === 'failed',
    );
  }, [filteredDocuments]);

  const singleSelectedDocument =
    selectedDocuments.length === 1 ? selectedDocuments[0] : null;

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setRenameTargetId(null);
    setRenameValue('');
    setCollectionInput('');
    setTagInput('');
  }, []);

  const setSelectedDocumentIds = useCallback((documentIds: number[]) => {
    const uniqueIds = Array.from(new Set(documentIds));
    setSelectedIds(uniqueIds);
    setRenameTargetId(null);
    setRenameValue('');
  }, []);

  const toggleSelectedId = useCallback((documentId: number) => {
    setSelectedIds((current) =>
      current.includes(documentId)
        ? current.filter((value) => value !== documentId)
        : [...current, documentId],
    );
  }, []);

  const logAuditSafely = useCallback(
    async (input: {
      documentId: number;
      actionKey: string;
      actionLabel: string;
      status: 'started' | 'completed' | 'failed' | 'requires_premium';
      reason?: string | null;
      metadata?: Record<string, unknown> | null;
    }) => {
      try {
        await logDocumentAuditEvent(input);
      } catch (error) {
        console.warn('[Documents] Audit log failed:', error);
      }
    },
    [],
  );

  const setBatchResultState = useCallback((result: BatchResult) => {
    setBatchResult(result);
  }, []);

  const runBatchOcr = useCallback(
    async ({
      targetDocuments,
      skippedDocuments,
      title,
      clearSelectionAfter = true,
    }: {
      targetDocuments: DocumentSummary[];
      skippedDocuments: DocumentSummary[];
      title: string;
      clearSelectionAfter?: boolean;
    }) => {
      if (!targetDocuments.length && !skippedDocuments.length) {
        return;
      }

      const failedTitles: string[] = [];
      const skippedTitles = skippedDocuments.map((item) => resolveDocumentTitle(item));
      const retryDocumentIds: number[] = [];
      let succeededCount = 0;
      let failedCount = 0;

      try {
        setBusy(true);
        setBusyLabel(`${title} hazırlanıyor...`);

        for (const item of skippedDocuments) {
          await logAuditSafely({
            documentId: item.id,
            actionKey: 'ocr',
            actionLabel: title,
            status: 'failed',
            reason:
              'Bu belge sayfa tabanlı değil. OCR yalnızca sayfa tabanlı belgelerde çalışır.',
          });
        }

        for (let index = 0; index < targetDocuments.length; index += 1) {
          const item = targetDocuments[index];
          setBusyLabel(`${title} (${index + 1}/${targetDocuments.length})...`);

          await logAuditSafely({
            documentId: item.id,
            actionKey: 'ocr',
            actionLabel: title,
            status: 'started',
          });

          try {
            const result = await extractDocumentText(item.id);
            succeededCount += 1;

            await logAuditSafely({
              documentId: item.id,
              actionKey: 'ocr',
              actionLabel: title,
              status: 'completed',
              metadata: {
                extractedPageCount: result.extractedPageCount,
                extractedCharacterCount: result.extractedCharacterCount,
                batch: true,
              },
            });
          } catch (error) {
            failedCount += 1;
            failedTitles.push(resolveDocumentTitle(item));
            retryDocumentIds.push(item.id);

            await logAuditSafely({
              documentId: item.id,
              actionKey: 'ocr',
              actionLabel: title,
              status: 'failed',
              reason:
                error instanceof Error ? error.message : 'Toplu OCR başarısız.',
            });
          }
        }

        await loadDocuments();

        if (clearSelectionAfter) {
          clearSelection();
        }

        setBatchResultState({
          key: 'ocr',
          title,
          completedAt: new Date().toISOString(),
          succeededCount,
          failedCount,
          skippedCount: skippedDocuments.length,
          failedTitles,
          skippedTitles,
          retryDocumentIds,
        });
      } finally {
        setBusy(false);
        setBusyLabel(null);
      }
    },
    [clearSelection, loadDocuments, logAuditSafely, setBatchResultState],
  );

  const runBatchPdfExport = useCallback(
    async ({
      targetDocuments,
      skippedDocuments,
      title,
      clearSelectionAfter = true,
    }: {
      targetDocuments: DocumentSummary[];
      skippedDocuments: DocumentSummary[];
      title: string;
      clearSelectionAfter?: boolean;
    }) => {
      if (!targetDocuments.length && !skippedDocuments.length) {
        return;
      }

      if (!billingHydrated) {
        return;
      }

      if (!capabilities.canExportPdf) {
        for (const item of [...targetDocuments, ...skippedDocuments]) {
          await logAuditSafely({
            documentId: item.id,
            actionKey: 'pdf',
            actionLabel: title,
            status: 'requires_premium',
            reason: 'Toplu PDF export premium gerektirir.',
          });
        }

        Alert.alert(
          'Premium gerekli',
          getPremiumGateMessage('export_pdf'),
          [
            {
              text: 'Şimdi değil',
              style: 'cancel',
            },
            {
              text: "Premium'u gör",
              onPress: () => navigation.navigate('Pricing'),
            },
          ],
        );
        return;
      }

      const failedTitles: string[] = [];
      const skippedTitles = skippedDocuments.map((item) => resolveDocumentTitle(item));
      const retryDocumentIds: number[] = [];
      let succeededCount = 0;
      let failedCount = 0;
      let reExportedCount = 0;

      try {
        setBusy(true);
        setBusyLabel(`${title} hazırlanıyor...`);

        for (const item of skippedDocuments) {
          await logAuditSafely({
            documentId: item.id,
            actionKey: 'pdf',
            actionLabel: title,
            status: 'failed',
            reason:
              'Bu belge sayfa tabanlı değil. PDF export yalnızca sayfa tabanlı belgelerde çalışır.',
          });
        }

        for (let index = 0; index < targetDocuments.length; index += 1) {
          const item = targetDocuments[index];
          setBusyLabel(`${title} (${index + 1}/${targetDocuments.length})...`);

          await logAuditSafely({
            documentId: item.id,
            actionKey: 'pdf',
            actionLabel: title,
            status: 'started',
          });

          try {
            const result = await exportDocumentToPdf(item.id);
            succeededCount += 1;

            if (resolveDocumentPdfPath(item)) {
              reExportedCount += 1;
            }

            await logAuditSafely({
              documentId: item.id,
              actionKey: 'pdf',
              actionLabel: title,
              status: 'completed',
              metadata: {
                fileName: result.fileName,
                batch: true,
                reExported: Boolean(resolveDocumentPdfPath(item)),
              },
            });
          } catch (error) {
            failedCount += 1;
            failedTitles.push(resolveDocumentTitle(item));
            retryDocumentIds.push(item.id);

            await logAuditSafely({
              documentId: item.id,
              actionKey: 'pdf',
              actionLabel: title,
              status: 'failed',
              reason:
                error instanceof Error
                  ? error.message
                  : 'Toplu PDF export başarısız.',
            });
          }
        }

        await loadDocuments();

        if (clearSelectionAfter) {
          clearSelection();
        }

        setBatchResultState({
          key: 'pdf',
          title,
          completedAt: new Date().toISOString(),
          succeededCount,
          failedCount,
          skippedCount: skippedDocuments.length,
          failedTitles,
          skippedTitles,
          retryDocumentIds,
          extraLine: `Yeniden oluşturulan: ${reExportedCount}`,
        });
      } finally {
        setBusy(false);
        setBusyLabel(null);
      }
    },
    [
      billingHydrated,
      capabilities.canExportPdf,
      clearSelection,
      loadDocuments,
      logAuditSafely,
      navigation,
      setBatchResultState,
    ],
  );

  const handleCardPress = useCallback(
    (item: DocumentSummary) => {
      if (selectionMode) {
        toggleSelectedId(item.id);
        return;
      }

      navigation.navigate('DocumentDetail', {
        documentId: item.id,
      });
    },
    [navigation, selectionMode, toggleSelectedId],
  );

  const handleCardLongPress = useCallback(
    (item: DocumentSummary) => {
      setRenameTargetId(null);
      setRenameValue('');
      toggleSelectedId(item.id);
    },
    [toggleSelectedId],
  );

  const handleToggleFavorite = useCallback(
    async (item: DocumentSummary) => {
      try {
        setBusy(true);
        setBusyLabel('Favori durumu güncelleniyor...');
        await setDocumentFavorite(item.id, !resolveDocumentIsFavorite(item));
        await loadDocuments();
      } catch (error) {
        Alert.alert(
          'Hata',
          error instanceof Error ? error.message : 'Favori durumu güncellenemedi.',
        );
      } finally {
        setBusy(false);
        setBusyLabel(null);
      }
    },
    [loadDocuments],
  );

  const handleBulkFavorite = useCallback(
    async (nextFavorite: boolean) => {
      if (!selectedIds.length) {
        return;
      }

      try {
        setBusy(true);
        setBusyLabel(nextFavorite ? 'Toplu favori uygulanıyor...' : 'Favoriler temizleniyor...');
        await setDocumentsFavorite(selectedIds, nextFavorite);
        await loadDocuments();
        clearSelection();
      } catch (error) {
        Alert.alert(
          'Hata',
          error instanceof Error ? error.message : 'Toplu favori işlemi başarısız.',
        );
      } finally {
        setBusy(false);
        setBusyLabel(null);
      }
    },
    [clearSelection, loadDocuments, selectedIds],
  );

  const handleAssignCollection = useCallback(
    async (collectionName: string | null) => {
      if (!selectedIds.length) {
        return;
      }

      try {
        setBusy(true);
        setBusyLabel('Klasör ataması uygulanıyor...');
        await setDocumentsCollection(selectedIds, collectionName);
        await loadDocuments();
        setCollectionInput('');
      } catch (error) {
        Alert.alert(
          'Hata',
          error instanceof Error ? error.message : 'Klasör atama başarısız.',
        );
      } finally {
        setBusy(false);
        setBusyLabel(null);
      }
    },
    [loadDocuments, selectedIds],
  );

  const handleAddTag = useCallback(
    async (tagName: string) => {
      if (!selectedIds.length) {
        return;
      }

      try {
        setBusy(true);
        setBusyLabel('Etiketler ekleniyor...');
        await addTagToDocuments(selectedIds, tagName);
        await loadDocuments();
        setTagInput('');
      } catch (error) {
        Alert.alert(
          'Hata',
          error instanceof Error ? error.message : 'Etiket eklenemedi.',
        );
      } finally {
        setBusy(false);
        setBusyLabel(null);
      }
    },
    [loadDocuments, selectedIds],
  );

  const handleOpenRename = useCallback(() => {
    if (!singleSelectedDocument) {
      return;
    }

    setRenameTargetId(singleSelectedDocument.id);
    setRenameValue(resolveDocumentTitle(singleSelectedDocument));
  }, [singleSelectedDocument]);

  const handleCancelRename = useCallback(() => {
    setRenameTargetId(null);
    setRenameValue('');
  }, []);

  const handleSubmitRename = useCallback(async () => {
    if (!renameTargetId) {
      return;
    }

    try {
      setBusy(true);
      setBusyLabel('Belge adı güncelleniyor...');
      await renameDocumentTitle(renameTargetId, renameValue);
      await loadDocuments();
      setRenameTargetId(null);
      setRenameValue('');
      clearSelection();
    } catch (error) {
      Alert.alert(
        'Hata',
        error instanceof Error ? error.message : 'Belge adı güncellenemedi.',
      );
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }, [clearSelection, loadDocuments, renameTargetId, renameValue]);

  const handleMergeDocuments = useCallback(async () => {
    if (selectedIds.length < 2) {
      return;
    }

    try {
      setBusy(true);
      setBusyLabel('Belgeler birleştiriliyor...');
      const result = await mergeDocuments(selectedIds);
      await loadDocuments();
      clearSelection();

      Alert.alert(
        'Belgeler birleştirildi',
        `${result.sourceDocumentCount} belge, ${result.mergedPageCount} sayfa olarak yeni kayda dönüştürüldü.`,
      );

      navigation.navigate('DocumentDetail', {
        documentId: result.documentId,
      });
    } catch (error) {
      Alert.alert(
        'Hata',
        error instanceof Error ? error.message : 'Belgeler birleştirilemedi.',
      );
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }, [clearSelection, loadDocuments, navigation, selectedIds]);

  const handleBatchOcr = useCallback(async () => {
    await runBatchOcr({
      targetDocuments: eligibleBatchDocuments,
      skippedDocuments: skippedBatchDocuments,
      title: 'Toplu OCR çıkar',
    });
  }, [eligibleBatchDocuments, runBatchOcr, skippedBatchDocuments]);

  const handleBatchPdfExport = useCallback(async () => {
    await runBatchPdfExport({
      targetDocuments: eligibleBatchDocuments,
      skippedDocuments: skippedBatchDocuments,
      title: 'Toplu PDF üret',
    });
  }, [eligibleBatchDocuments, runBatchPdfExport, skippedBatchDocuments]);

  const handleRetrySelectedFailedOcr = useCallback(async () => {
    await runBatchOcr({
      targetDocuments: retryableSelectedFailedDocuments,
      skippedDocuments: [],
      title: 'Başarısız OCR işlemlerini yeniden dene',
    });
  }, [retryableSelectedFailedDocuments, runBatchOcr]);

  const handleSelectFailedVisibleDocuments = useCallback(() => {
    setSelectedDocumentIds(failedVisibleDocuments.map((item) => item.id));
  }, [failedVisibleDocuments, setSelectedDocumentIds]);

  const handleRetryFailedVisibleOcr = useCallback(async () => {
    await runBatchOcr({
      targetDocuments: failedVisibleDocuments,
      skippedDocuments: [],
      title: 'Filtredeki başarısız OCR işlemlerini yeniden dene',
      clearSelectionAfter: false,
    });
  }, [failedVisibleDocuments, runBatchOcr]);

  const handleRetryFailedVisibleOcrPress = useCallback(() => {
    void handleRetryFailedVisibleOcr();
  }, [handleRetryFailedVisibleOcr]);

  const recoverySummary = useMemo(
    () =>
      buildDocumentsRecoverySummary({
        overview,
        failedVisibleCount: failedVisibleDocuments.length,
        filteredCount: filteredDocuments.length,
        busy,
        onSelectFailed: handleSelectFailedVisibleDocuments,
        onRetryFailed: handleRetryFailedVisibleOcrPress,
      }),
    [
      busy,
      failedVisibleDocuments.length,
      filteredDocuments.length,
      handleRetryFailedVisibleOcrPress,
      handleSelectFailedVisibleDocuments,
      overview,
    ],
  );

  const handleSelectBatchRetryDocuments = useCallback(() => {
    if (!batchResult?.retryDocumentIds.length) {
      return;
    }

    setSelectedDocumentIds(batchResult.retryDocumentIds);
  }, [batchResult, setSelectedDocumentIds]);

  const handleRetryBatchResult = useCallback(async () => {
    if (!batchResult?.retryDocumentIds.length) {
      return;
    }

    const retryDocuments = documents.filter((item) =>
      batchResult.retryDocumentIds.includes(item.id),
    );

    if (!retryDocuments.length) {
      return;
    }

    if (batchResult.key === 'ocr') {
      await runBatchOcr({
        targetDocuments: retryDocuments.filter(
          (item) => resolveDocumentPageCount(item) > 0,
        ),
        skippedDocuments: retryDocuments.filter(
          (item) => resolveDocumentPageCount(item) <= 0,
        ),
        title: 'Başarısız toplu OCR işlemlerini yeniden dene',
      });
      return;
    }

    await runBatchPdfExport({
      targetDocuments: retryDocuments.filter(
        (item) => resolveDocumentPageCount(item) > 0,
      ),
      skippedDocuments: retryDocuments.filter(
        (item) => resolveDocumentPageCount(item) <= 0,
      ),
      title: 'Başarısız toplu PDF işlemlerini yeniden dene',
    });
  }, [batchResult, documents, runBatchOcr, runBatchPdfExport]);

  const batchPdfButtonLabel = !billingHydrated
    ? 'Toplu PDF'
    : capabilities.canExportPdf
      ? 'Toplu PDF'
      : 'Toplu PDF (Premium)';

  const overviewItems = useMemo<DocumentsOverviewItem[]>(
    () => [
      {
        key: 'total',
        title: 'Toplam belge',
        subtitle: 'Kütüphanedeki tüm kayıtlar',
        value: overview.totalCount,
        icon: 'folder-open-outline',
        tone: 'accent',
      },
      {
        key: 'pages',
        title: 'Toplam sayfa',
        subtitle: 'Sayfa tabanlı belge yüzeyi',
        value: overview.totalPages,
        icon: 'layers-outline',
      },
      {
        key: 'pdf',
        title: 'PDF hazır',
        subtitle: 'Sonuçlandırılmış kayıtlar',
        value: overview.pdfReadyCount || overview.readyCount,
        icon: 'document-outline',
        tone: 'success',
      },
      {
        key: 'processing',
        title: 'İşleniyor',
        subtitle: 'OCR pipeline aktif kayıtlar',
        value: overview.processingCount,
        icon: 'hourglass-outline',
        tone: overview.processingCount > 0 ? 'warning' : 'default',
      },
      {
        key: 'failed',
        title: 'OCR hata',
        subtitle: 'Recovery bekleyen kayıtlar',
        value: overview.failedCount,
        icon: 'alert-circle-outline',
        tone: overview.failedCount > 0 ? 'warning' : 'default',
      },
      {
        key: 'favorite',
        title: 'Favori',
        subtitle: 'Hızlı dönüş için işaretlenenler',
        value: overview.favoriteCount,
        icon: 'star-outline',
      },
    ],
    [overview.favoriteCount, overview.failedCount, overview.pdfReadyCount, overview.processingCount, overview.readyCount, overview.totalCount, overview.totalPages],
  );

  const filterItems = useMemo<DocumentChipItem[]>(
    () => [
      { key: 'all', label: 'Tümü', selected: filter === 'all', onPress: () => setFilter('all') },
      { key: 'draft', label: 'Taslak', selected: filter === 'draft', onPress: () => setFilter('draft') },
      { key: 'ready', label: 'Hazır', selected: filter === 'ready', onPress: () => setFilter('ready') },
      { key: 'ocr', label: 'OCR', selected: filter === 'ocr', onPress: () => setFilter('ocr') },
      { key: 'processing', label: 'İşleniyor', selected: filter === 'processing', onPress: () => setFilter('processing') },
      { key: 'failed', label: 'Hata', selected: filter === 'failed', onPress: () => setFilter('failed') },
      { key: 'pdf', label: 'PDF', selected: filter === 'pdf', onPress: () => setFilter('pdf') },
      { key: 'favorite', label: 'Favori', selected: filter === 'favorite', onPress: () => setFilter('favorite') },
    ],
    [filter],
  );

  const collectionItems = useMemo<DocumentChipItem[]>(
    () => [
      {
        key: 'all',
        label: 'Tümü',
        selected: selectedCollectionName === null,
        onPress: () => setSelectedCollectionName(null),
      },
      ...collections.map((item) => ({
        key: `collection-${item.id}`,
        label: item.name,
        selected: selectedCollectionName === item.name,
        onPress: () =>
          setSelectedCollectionName((current) =>
            current === item.name ? null : item.name,
          ),
      })),
    ],
    [collections, selectedCollectionName],
  );

  const tagItems = useMemo<DocumentChipItem[]>(
    () => [
      {
        key: 'all',
        label: 'Tümü',
        selected: selectedTagName === null,
        onPress: () => setSelectedTagName(null),
      },
      ...tags.slice(0, 10).map((item) => ({
        key: `tag-${item.id}`,
        label: `#${item.name}`,
        selected: selectedTagName === item.name,
        onPress: () =>
          setSelectedTagName((current) =>
            current === item.name ? null : item.name,
          ),
      })),
    ],
    [selectedTagName, tags],
  );

  const selectableCollectionItems = useMemo<DocumentChipItem[]>(
    () => [
      ...collections.map((item) => ({
        key: `assign-collection-${item.id}`,
        label: item.name,
        onPress: () => {
          void handleAssignCollection(item.name);
        },
      })),
      {
        key: 'assign-collection-clear',
        label: 'Klasörü temizle',
        onPress: () => {
          void handleAssignCollection(null);
        },
      },
    ],
    [collections, handleAssignCollection],
  );

  const selectableTagItems = useMemo<DocumentChipItem[]>(
    () =>
      tags.slice(0, 10).map((item) => ({
        key: `assign-tag-${item.id}`,
        label: `#${item.name}`,
        onPress: () => {
          void handleAddTag(item.name);
        },
      })),
    [handleAddTag, tags],
  );

  return (
    <Screen
      title="Dosyalar"
      subtitle="Belgelerini ara, filtrele ve kaldığın yerden devam et."
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroEyebrow}>Belge merkezi</Text>
            <Text style={styles.heroTitle}>Kütüphanen hazır</Text>
            <Text style={styles.heroText}>
              Tüm taramalar, taslaklar, OCR hazır kayıtlar ve PDF çıktıları tek yerde.
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('ScanEntry', { initialMode: 'camera' })}
            style={({ pressed }) => [
              styles.heroActionButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="scan-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.heroActionButtonText}>Yeni</Text>
          </Pressable>
        </View>

        <View style={styles.heroInfoRow}>
          <LocalTrustBadge compact />
          <View style={styles.heroMiniPill}>
            <Text style={styles.heroMiniPillText}>
              {loading ? 'Yükleniyor' : `${filteredDocuments.length} görünür kayıt`}
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textTertiary}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Belge ara"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
        </View>
      </View>

      <DocumentsOverviewStrip items={overviewItems} />

      <View style={styles.filterSection}>
        <Text style={styles.filterSectionTitle}>Durum filtreleri</Text>
        <DocumentChipRow items={filterItems} />
      </View>

      {collections.length > 0 ? (
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Klasör filtresi</Text>
          <DocumentChipRow items={collectionItems} />
        </View>
      ) : null}

      {tags.length > 0 ? (
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Etiket filtresi</Text>
          <DocumentChipRow items={tagItems} />
        </View>
      ) : null}

      {!selectionMode && recoverySummary ? (
        <DocumentPipelineSummaryCard {...recoverySummary} />
      ) : null}

      {batchResult ? (
        <View style={styles.batchResultCard}>
          <View style={styles.batchResultHeader}>
            <View>
              <Text style={styles.batchResultTitle}>{batchResult.title}</Text>
              <Text style={styles.batchResultMeta}>
                {formatDate(batchResult.completedAt)}
              </Text>
            </View>

            <Pressable
              onPress={() => setBatchResult(null)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Ionicons
                name="close-outline"
                size={20}
                color={colors.textTertiary}
              />
            </Pressable>
          </View>

          <Text style={styles.batchResultText}>
            {formatBatchSummaryText(batchResult)}
          </Text>

          {batchResult.retryDocumentIds.length > 0 ? (
            <View style={styles.batchResultActions}>
              <Pressable
                onPress={handleSelectBatchRetryDocuments}
                style={({ pressed }) => [
                  styles.secondaryButtonCompact,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonCompactText}>Başarısızları seç</Text>
              </Pressable>

              <Pressable
                onPress={() => void handleRetryBatchResult()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryButtonCompact,
                  pressed && !busy && styles.pressed,
                  busy && styles.selectionActionButtonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonCompactText}>Yeniden dene</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {selectionMode ? (
        <View style={styles.selectionToolbar}>
          <View style={styles.selectionToolbarHeader}>
            <Text style={styles.selectionToolbarTitle}>Seçim modu</Text>
            <Text style={styles.selectionToolbarHint}>
              {selectedIds.length} belge seçildi • OCR/PDF uygun: {eligibleBatchDocuments.length}
            </Text>
          </View>

          <View style={styles.selectionToolbarActions}>
            <Pressable
              onPress={() => void handleBatchOcr()}
              disabled={busy || eligibleBatchDocuments.length === 0}
              style={({ pressed }) => [
                styles.selectionActionButton,
                pressed && !busy && eligibleBatchDocuments.length > 0 && styles.pressed,
                (busy || eligibleBatchDocuments.length === 0) &&
                  styles.selectionActionButtonDisabled,
              ]}
            >
              <Ionicons name="scan-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.selectionActionButtonText}>Toplu OCR</Text>
            </Pressable>

            {retryableSelectedFailedDocuments.length > 0 ? (
              <Pressable
                onPress={() => void handleRetrySelectedFailedOcr()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.selectionActionButton,
                  pressed && !busy && styles.pressed,
                  busy && styles.selectionActionButtonDisabled,
                ]}
              >
                <Ionicons name="refresh-outline" size={16} color="#FBBF24" />
                <Text style={styles.selectionActionButtonText}>Hatalı OCR’yi tekrar dene</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => void handleBatchPdfExport()}
              disabled={busy || !billingHydrated || eligibleBatchDocuments.length === 0}
              style={({ pressed }) => [
                styles.selectionActionButton,
                pressed && !busy && billingHydrated && eligibleBatchDocuments.length > 0 && styles.pressed,
                (busy || !billingHydrated || eligibleBatchDocuments.length === 0) &&
                  styles.selectionActionButtonDisabled,
              ]}
            >
              <Ionicons
                name="document-outline"
                size={16}
                color={capabilities.canExportPdf ? colors.textSecondary : colors.primary}
              />
              <Text
                style={[
                  styles.selectionActionButtonText,
                  !capabilities.canExportPdf && styles.selectionActionButtonTextAccent,
                ]}
              >
                {batchPdfButtonLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void handleBulkFavorite(true)}
              disabled={busy}
              style={({ pressed }) => [
                styles.selectionActionButton,
                pressed && !busy && styles.pressed,
                busy && styles.selectionActionButtonDisabled,
              ]}
            >
              <Ionicons name="star" size={16} color={colors.primary} />
              <Text style={styles.selectionActionButtonText}>Favori yap</Text>
            </Pressable>

            <Pressable
              onPress={() => void handleBulkFavorite(false)}
              disabled={busy}
              style={({ pressed }) => [
                styles.selectionActionButton,
                pressed && !busy && styles.pressed,
                busy && styles.selectionActionButtonDisabled,
              ]}
            >
              <Ionicons name="star-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.selectionActionButtonText}>Favoriden çıkar</Text>
            </Pressable>

            {selectedIds.length >= 2 ? (
              <Pressable
                onPress={() => void handleMergeDocuments()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.selectionActionButton,
                  pressed && !busy && styles.pressed,
                  busy && styles.selectionActionButtonDisabled,
                ]}
              >
                <Ionicons name="git-merge-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.selectionActionButtonText}>Birleştir</Text>
              </Pressable>
            ) : null}

            {singleSelectedDocument ? (
              <Pressable
                onPress={handleOpenRename}
                disabled={busy}
                style={({ pressed }) => [
                  styles.selectionActionButton,
                  pressed && !busy && styles.pressed,
                  busy && styles.selectionActionButtonDisabled,
                ]}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.selectionActionButtonText}>Yeniden adlandır</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={clearSelection}
              disabled={busy}
              style={({ pressed }) => [
                styles.selectionActionButton,
                pressed && !busy && styles.pressed,
                busy && styles.selectionActionButtonDisabled,
              ]}
            >
              <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.selectionActionButtonText}>Vazgeç</Text>
            </Pressable>
          </View>

          <View style={styles.taxonomyManagerCard}>
            <Text style={styles.taxonomyManagerTitle}>Klasör ata</Text>

            <View style={styles.taxonomyInputRow}>
              <TextInput
                value={collectionInput}
                onChangeText={setCollectionInput}
                placeholder="Yeni klasör adı"
                placeholderTextColor={colors.textTertiary}
                style={styles.taxonomyInput}
                maxLength={48}
              />

              <Pressable
                onPress={() => void handleAssignCollection(collectionInput)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.taxonomyActionButton,
                  pressed && !busy && styles.pressed,
                  busy && styles.selectionActionButtonDisabled,
                ]}
              >
                <Text style={styles.taxonomyActionButtonText}>Ata</Text>
              </Pressable>
            </View>

            <DocumentChipRow items={selectableCollectionItems} />
          </View>

          <View style={styles.taxonomyManagerCard}>
            <Text style={styles.taxonomyManagerTitle}>Etiket ekle</Text>

            <View style={styles.taxonomyInputRow}>
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Yeni etiket"
                placeholderTextColor={colors.textTertiary}
                style={styles.taxonomyInput}
                maxLength={48}
              />

              <Pressable
                onPress={() => void handleAddTag(tagInput)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.taxonomyActionButton,
                  pressed && !busy && styles.pressed,
                  busy && styles.selectionActionButtonDisabled,
                ]}
              >
                <Text style={styles.taxonomyActionButtonText}>Ekle</Text>
              </Pressable>
            </View>

            <DocumentChipRow items={selectableTagItems} />
          </View>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Belge listesi</Text>
        <Text style={styles.sectionHint}>
          {loading ? 'Yükleniyor' : `${filteredDocuments.length} kayıt`}
        </Text>
      </View>

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.busyText}>{busyLabel ?? 'İşlem uygulanıyor...'}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Belgeler yükleniyor...</Text>
        </View>
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          onCreate={() => navigation.navigate('ScanEntry', { initialMode: 'camera' })}
          onImport={() =>
            navigation.navigate('ScanEntry', { initialMode: 'import-files' })
          }
        />
      ) : (
        <View style={styles.list}>
          {filteredDocuments.map((item) => (
            <DocumentLibraryCard
              key={item.id}
              item={item}
              selectionMode={selectionMode}
              selected={selectedIds.includes(item.id)}
              renameOpen={renameTargetId === item.id}
              renameValue={renameTargetId === item.id ? renameValue : ''}
              updatedAtLabel={formatDate(item.updated_at)}
              onChangeRenameValue={setRenameValue}
              onSubmitRename={() => void handleSubmitRename()}
              onCancelRename={handleCancelRename}
              onOpen={() => handleCardPress(item)}
              onLongPress={() => handleCardLongPress(item)}
              onToggleFavorite={() => void handleToggleFavorite(item)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  heroTopRow: {
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
  heroActionButton: {
    minHeight: 42,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroActionButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  heroInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroMiniPill: {
    minHeight: 30,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  heroMiniPillText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  searchWrap: {
    minHeight: 48,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: colors.text,
    ...Typography.body,
  },
  filterSection: {
    gap: Spacing.sm,
  },
  filterSectionTitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  batchResultCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  batchResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  batchResultTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  batchResultMeta: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  batchResultText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  batchResultActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryButtonCompact: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  primaryButtonCompactText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryButtonCompact: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  secondaryButtonCompactText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  selectionToolbar: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  selectionToolbarHeader: {
    gap: 4,
  },
  selectionToolbarTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  selectionToolbarHint: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  selectionToolbarActions: {
    gap: Spacing.sm,
  },
  selectionActionButton: {
    minHeight: 42,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionActionButtonDisabled: {
    opacity: 0.6,
  },
  selectionActionButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  selectionActionButtonTextAccent: {
    color: colors.primary,
  },
  taxonomyManagerCard: {
    gap: Spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  taxonomyManagerTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  taxonomyInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  taxonomyInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  taxonomyActionButton: {
    minHeight: 44,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxonomyActionButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
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
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  busyText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  emptyActionRow: {
    gap: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  secondaryButtonText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    gap: Spacing.md,
  },
  pressed: {
    opacity: 0.92,
  },
});