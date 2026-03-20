// src/screens/documents/DocumentsScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import { LocalTrustBadge } from '../../components/trust/LocalTrustBadge';
import {
  getPremiumGateMessage,
  resolveBillingCapabilities,
} from '../../modules/billing/billing-capabilities';
import { logDocumentAuditEvent } from '../../modules/documents/document-audit.service';
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

function isFavorite(item: DocumentSummary) {
  return item.is_favorite === 1;
}

function getStatusLabel(item: DocumentSummary) {
  if (item.pdf_path && item.status === 'ready') {
    return 'PDF Hazır';
  }

  if (item.ocr_status === 'processing') {
    return 'OCR İşleniyor';
  }

  if (item.ocr_status === 'failed') {
    return 'OCR Hata';
  }

  if (item.ocr_status === 'ready') {
    return 'OCR Hazır';
  }

  switch (item.status) {
    case 'draft':
      return 'Taslak';
    case 'ready':
      return 'Hazır';
    case 'exported':
      return 'PDF Oluşturuldu';
    default:
      return item.status;
  }
}

function getStatusTone(item: DocumentSummary) {
  if (item.pdf_path && item.status === 'ready') {
    return 'success' as const;
  }

  if (item.ocr_status === 'processing' || item.ocr_status === 'ready') {
    return 'accent' as const;
  }

  if (item.ocr_status === 'failed') {
    return 'danger' as const;
  }

  if (item.status === 'draft') {
    return 'muted' as const;
  }

  return 'default' as const;
}

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
  switch (filter) {
    case 'draft':
      return item.status === 'draft';
    case 'ready':
      return item.status === 'ready';
    case 'ocr':
      return item.ocr_status === 'ready';
    case 'processing':
      return item.ocr_status === 'processing';
    case 'failed':
      return item.ocr_status === 'failed';
    case 'pdf':
      return Boolean(item.pdf_path);
    case 'favorite':
      return isFavorite(item);
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

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected && styles.filterChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TaxonomyChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.taxonomyChip,
        selected && styles.taxonomyChipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.taxonomyChipText,
          selected && styles.taxonomyChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>

      <View style={styles.statTextWrap}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
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

function StatusBadge({ item }: { item: DocumentSummary }) {
  const tone = getStatusTone(item);

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
        {getStatusLabel(item)}
      </Text>
    </View>
  );
}

function DocumentCard({
  item,
  selectionMode,
  selected,
  renameOpen,
  renameValue,
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
  onChangeRenameValue: (value: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onOpen: () => void;
  onLongPress: () => void;
  onToggleFavorite: () => void;
}) {
  const favorite = isFavorite(item);

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
          {item.thumbnail_path ? (
            <Image source={{ uri: item.thumbnail_path }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons
                name="document-text-outline"
                size={22}
                color={colors.textTertiary}
              />
              <Text style={styles.thumbnailPlaceholderText}>Önizleme yok</Text>
            </View>
          )}

          {selected ? (
            <View style={styles.selectionBadge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            </View>
          ) : null}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardTitleWrap}>
              <Text numberOfLines={2} style={styles.cardTitle}>
                {item.title}
              </Text>

              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMeta}>Sayfa: {item.page_count}</Text>
                <Text style={styles.cardMetaDot}>•</Text>
                <Text style={styles.cardMeta}>{formatDate(item.updated_at)}</Text>
              </View>
            </View>

            <Ionicons
              name={selectionMode ? 'checkmark-done-outline' : 'chevron-forward'}
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

            {item.tag_names.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.inlineMiniBadge}>
                <Text style={styles.inlineMiniBadgeText}>#{tag}</Text>
              </View>
            ))}

            {item.word_path ? (
              <View style={styles.inlineMiniBadge}>
                <Text style={styles.inlineMiniBadgeText}>WORD</Text>
              </View>
            ) : null}

            {item.pdf_path ? (
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

export function DocumentsScreen() {
  const navigation = useNavigation<any>();

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

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');

    return [...documents]
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
          item.title,
          item.status,
          item.ocr_status,
          getStatusLabel(item),
          item.collection_name ?? '',
          ...item.tag_names,
          isFavorite(item) ? 'favori' : '',
          'local',
          'cihazda kalır',
        ]
          .join(' ')
          .toLocaleLowerCase('tr-TR');

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        const favoriteDelta = Number(isFavorite(right)) - Number(isFavorite(left));

        if (favoriteDelta !== 0) {
          return favoriteDelta;
        }

        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      });
  }, [documents, filter, query, selectedCollectionName, selectedTagName]);

  const totalPages = useMemo(() => {
    return documents.reduce((sum, item) => sum + item.page_count, 0);
  }, [documents]);

  const draftCount = useMemo(() => {
    return documents.filter((item) => item.status === 'draft').length;
  }, [documents]);

  const readyCount = useMemo(() => {
    return documents.filter((item) => item.status === 'ready').length;
  }, [documents]);

  const pdfCount = useMemo(() => {
    return documents.filter((item) => Boolean(item.pdf_path)).length;
  }, [documents]);

  const favoriteCount = useMemo(() => {
    return documents.filter((item) => isFavorite(item)).length;
  }, [documents]);

  const processingCount = useMemo(() => {
    return documents.filter((item) => item.ocr_status === 'processing').length;
  }, [documents]);

  const failedOcrCount = useMemo(() => {
    return documents.filter((item) => item.ocr_status === 'failed').length;
  }, [documents]);

  const selectedDocuments = useMemo(() => {
    return documents.filter((item) => selectedIds.includes(item.id));
  }, [documents, selectedIds]);

  const eligibleBatchDocuments = useMemo(() => {
    return selectedDocuments.filter((item) => item.page_count > 0);
  }, [selectedDocuments]);

  const skippedBatchDocuments = useMemo(() => {
    return selectedDocuments.filter((item) => item.page_count <= 0);
  }, [selectedDocuments]);

  const retryableSelectedFailedDocuments = useMemo(() => {
    return selectedDocuments.filter(
      (item) => item.page_count > 0 && item.ocr_status === 'failed',
    );
  }, [selectedDocuments]);

  const failedVisibleDocuments = useMemo(() => {
    return filteredDocuments.filter(
      (item) => item.page_count > 0 && item.ocr_status === 'failed',
    );
  }, [filteredDocuments]);

  const singleSelectedDocument = selectedDocuments.length === 1 ? selectedDocuments[0] : null;

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
      const skippedTitles = skippedDocuments.map((item) => item.title);
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
            failedTitles.push(item.title);
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
      const skippedTitles = skippedDocuments.map((item) => item.title);
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

            if (item.pdf_path) {
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
                reExported: Boolean(item.pdf_path),
              },
            });
          } catch (error) {
            failedCount += 1;
            failedTitles.push(item.title);
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
        await setDocumentFavorite(item.id, !isFavorite(item));
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
    setRenameValue(singleSelectedDocument.title);
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
        targetDocuments: retryDocuments.filter((item) => item.page_count > 0),
        skippedDocuments: retryDocuments.filter((item) => item.page_count <= 0),
        title: 'Başarısız toplu OCR işlemlerini yeniden dene',
      });
      return;
    }

    await runBatchPdfExport({
      targetDocuments: retryDocuments.filter((item) => item.page_count > 0),
      skippedDocuments: retryDocuments.filter((item) => item.page_count <= 0),
      title: 'Başarısız toplu PDF işlemlerini yeniden dene',
    });
  }, [batchResult, documents, runBatchOcr, runBatchPdfExport]);

  const batchPdfButtonLabel = !billingHydrated
    ? 'Toplu PDF'
    : capabilities.canExportPdf
      ? 'Toplu PDF'
      : 'Toplu PDF (Premium)';

  return (
    <Screen
      title="Dosyalar"
      subtitle="Belgelerini ara, filtrele ve kaldığın yerden devam et."
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Belge merkezi</Text>
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

        <LocalTrustBadge />

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

        <View style={styles.filterRow}>
          <FilterChip
            label="Tümü"
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterChip
            label="Taslak"
            selected={filter === 'draft'}
            onPress={() => setFilter('draft')}
          />
          <FilterChip
            label="Hazır"
            selected={filter === 'ready'}
            onPress={() => setFilter('ready')}
          />
          <FilterChip
            label="OCR"
            selected={filter === 'ocr'}
            onPress={() => setFilter('ocr')}
          />
          <FilterChip
            label="İşleniyor"
            selected={filter === 'processing'}
            onPress={() => setFilter('processing')}
          />
          <FilterChip
            label="Hata"
            selected={filter === 'failed'}
            onPress={() => setFilter('failed')}
          />
          <FilterChip
            label="PDF"
            selected={filter === 'pdf'}
            onPress={() => setFilter('pdf')}
          />
          <FilterChip
            label="Favori"
            selected={filter === 'favorite'}
            onPress={() => setFilter('favorite')}
          />
        </View>

        {collections.length > 0 ? (
          <View style={styles.taxonomySection}>
            <Text style={styles.taxonomyLabel}>Klasör filtresi</Text>
            <View style={styles.taxonomyRow}>
              <TaxonomyChip
                label="Tümü"
                selected={selectedCollectionName === null}
                onPress={() => setSelectedCollectionName(null)}
              />
              {collections.map((item) => (
                <TaxonomyChip
                  key={item.id}
                  label={item.name}
                  selected={selectedCollectionName === item.name}
                  onPress={() =>
                    setSelectedCollectionName((current) =>
                      current === item.name ? null : item.name,
                    )
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        {tags.length > 0 ? (
          <View style={styles.taxonomySection}>
            <Text style={styles.taxonomyLabel}>Etiket filtresi</Text>
            <View style={styles.taxonomyRow}>
              <TaxonomyChip
                label="Tümü"
                selected={selectedTagName === null}
                onPress={() => setSelectedTagName(null)}
              />
              {tags.slice(0, 10).map((item) => (
                <TaxonomyChip
                  key={item.id}
                  label={`#${item.name}`}
                  selected={selectedTagName === item.name}
                  onPress={() =>
                    setSelectedTagName((current) =>
                      current === item.name ? null : item.name,
                    )
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Toplam belge" value={documents.length} icon="folder-open-outline" />
        <StatCard label="Toplam sayfa" value={totalPages} icon="layers-outline" />
        <StatCard label="Taslak" value={draftCount} icon="create-outline" />
        <StatCard label="PDF hazır" value={pdfCount || readyCount} icon="document-outline" />
        <StatCard label="İşleniyor" value={processingCount} icon="hourglass-outline" />
        <StatCard label="OCR hata" value={failedOcrCount} icon="alert-circle-outline" />
        <StatCard label="Favori" value={favoriteCount} icon="star-outline" />
      </View>

      {!selectionMode && failedVisibleDocuments.length > 0 ? (
        <View style={styles.recoveryCard}>
          <View style={styles.recoveryHeader}>
            <View style={styles.recoveryIconWrap}>
              <Ionicons name="refresh-outline" size={18} color="#FBBF24" />
            </View>
            <View style={styles.recoveryTextWrap}>
              <Text style={styles.recoveryTitle}>Başarısız OCR kayıtları var</Text>
              <Text style={styles.recoveryText}>
                Bu filtrede {failedVisibleDocuments.length} belge OCR hatası verdi.
                İstersen seçip toplu tekrar deneyebilirsin.
              </Text>
            </View>
          </View>

          <View style={styles.recoveryActions}>
            <Pressable
              onPress={handleSelectFailedVisibleDocuments}
              style={({ pressed }) => [
                styles.secondaryButtonCompact,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonCompactText}>Başarısızları seç</Text>
            </Pressable>

            <Pressable
              onPress={() => void handleRetryFailedVisibleOcr()}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryButtonCompact,
                pressed && !busy && styles.pressed,
                busy && styles.selectionActionButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonCompactText}>Tekrar dene</Text>
            </Pressable>
          </View>
        </View>
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
              <Ionicons name="close-outline" size={20} color={colors.textTertiary} />
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

            <View style={styles.taxonomyRow}>
              {collections.map((item) => (
                <TaxonomyChip
                  key={item.id}
                  label={item.name}
                  selected={false}
                  onPress={() => void handleAssignCollection(item.name)}
                />
              ))}
              <TaxonomyChip
                label="Klasörü temizle"
                selected={false}
                onPress={() => void handleAssignCollection(null)}
              />
            </View>
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

            <View style={styles.taxonomyRow}>
              {tags.slice(0, 10).map((item) => (
                <TaxonomyChip
                  key={item.id}
                  label={`#${item.name}`}
                  selected={false}
                  onPress={() => void handleAddTag(item.name)}
                />
              ))}
            </View>
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
            <DocumentCard
              key={item.id}
              item={item}
              selectionMode={selectionMode}
              selected={selectedIds.includes(item.id)}
              renameOpen={renameTargetId === item.id}
              renameValue={renameTargetId === item.id ? renameValue : ''}
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: colors.onPrimary,
  },
  taxonomySection: {
    gap: Spacing.sm,
  },
  taxonomyLabel: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  taxonomyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  taxonomyChip: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxonomyChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  taxonomyChipText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  taxonomyChipTextSelected: {
    color: colors.primary,
  },
  statsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTextWrap: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  statValue: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  recoveryCard: {
    backgroundColor: colors.card,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  recoveryHeader: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  recoveryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryTextWrap: {
    flex: 1,
    gap: 4,
  },
  recoveryTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  recoveryText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  recoveryActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  batchResultCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
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
    width: 78,
    height: 104,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0F141B',
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
    borderRadius: 999,
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
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  cardMetaDot: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    borderRadius: 999,
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
    borderRadius: 999,
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
    borderRadius: 999,
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