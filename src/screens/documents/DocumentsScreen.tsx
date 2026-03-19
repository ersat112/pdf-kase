// src/screens/documents/DocumentsScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import {
  getRecentDocuments,
  type DocumentSummary,
} from '../../modules/documents/document.service';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

type FilterKey = 'all' | 'draft' | 'ready' | 'ocr' | 'pdf';

function getStatusLabel(item: DocumentSummary) {
  if (item.pdf_path && item.status === 'ready') {
    return 'PDF Hazır';
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
    return 'success';
  }

  if (item.ocr_status === 'ready') {
    return 'accent';
  }

  if (item.status === 'draft') {
    return 'muted';
  }

  return 'default';
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
    case 'pdf':
      return Boolean(item.pdf_path);
    case 'all':
    default:
      return true;
  }
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
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          tone === 'success' && styles.statusBadgeTextSuccess,
          tone === 'accent' && styles.statusBadgeTextAccent,
          tone === 'muted' && styles.statusBadgeTextMuted,
        ]}
      >
        {getStatusLabel(item)}
      </Text>
    </View>
  );
}

function DocumentCard({
  item,
  onPress,
}: {
  item: DocumentSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
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
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </View>

        <View style={styles.cardBottomRow}>
          <StatusBadge item={item} />

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
  );
}

export function DocumentsScreen() {
  const navigation = useNavigation<any>();

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await getRecentDocuments(100);
      setDocuments(rows);
    } catch (error) {
      console.warn('[Documents] Load failed:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDocuments();
    }, [loadDocuments]),
  );

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');

    return documents.filter((item) => {
      if (!matchesFilter(item, filter)) {
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
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR');

      return haystack.includes(normalizedQuery);
    });
  }, [documents, filter, query]);

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
            label="PDF"
            selected={filter === 'pdf'}
            onPress={() => setFilter('pdf')}
          />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Toplam belge" value={documents.length} icon="folder-open-outline" />
        <StatCard label="Toplam sayfa" value={totalPages} icon="layers-outline" />
        <StatCard label="Taslak" value={draftCount} icon="create-outline" />
        <StatCard label="PDF hazır" value={pdfCount || readyCount} icon="document-outline" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Belge listesi</Text>
        <Text style={styles.sectionHint}>
          {loading ? 'Yükleniyor' : `${filteredDocuments.length} kayıt`}
        </Text>
      </View>

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
              onPress={() =>
                navigation.navigate('DocumentDetail', {
                  documentId: item.id,
                })
              }
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
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    ...Shadows.sm,
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
  pressed: {
    opacity: 0.92,
  },
});